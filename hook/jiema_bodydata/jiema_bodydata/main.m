// DecodeIMAttr.m
// clang -fobjc-arc -framework Foundation DecodeIMAttr.m -o DecodeIMAttr

#import <Foundation/Foundation.h>
#if __has_include(<AppKit/AppKit.h>)
#import <AppKit/AppKit.h>   // macOS
#define HAS_DOC_PARSER 1
#elif __has_include(<UIKit/UIKit.h>)
#import <UIKit/UIKit.h>     // iOS
#define HAS_DOC_PARSER 1
#endif
static void DumpAttributedString(NSAttributedString *attr) {
    if (!attr) { printf("Decode failed.\n"); return; }

    printf("Plain string:\n%s\n\n", attr.string.UTF8String);

    __block NSInteger idx = 0;
    [attr enumerateAttributesInRange:NSMakeRange(0, attr.length)
                             options:0
                          usingBlock:^(NSDictionary<NSAttributedStringKey,id> * _Nonnull attrs, NSRange range, BOOL * _Nonnull stop) {
        idx++;
        NSLog(@"[%ld] range={%lu,%lu} attrs=%@", (long)idx,
              (unsigned long)range.location, (unsigned long)range.length, attrs);
    }];
    printf("\nSegments = %ld\n", (long)idx);
}

static NSAttributedString *DecodeFromData(NSData *data) {
    if (data.length == 0) return nil;

    // 1) 现代 Keyed 归档（万一是 bplist/keyed）
    NSError *err = nil;
    NSAttributedString *obj =
    [NSKeyedUnarchiver unarchivedObjectOfClass:[NSAttributedString class] fromData:data error:&err];
    if (obj) return obj;

    // 1.1) 放宽允许类集合再试一次
    @try {
        NSKeyedUnarchiver *un = [[NSKeyedUnarchiver alloc] initForReadingFromData:data error:nil];
        un.requiresSecureCoding = NO;
        NSSet *allowed = [NSSet setWithArray:@[
            [NSAttributedString class], [NSMutableAttributedString class],
            [NSString class], [NSNumber class], [NSDictionary class],
            [NSArray class], [NSValue class]
        ]];
        id root = [un decodeObjectOfClasses:allowed forKey:NSKeyedArchiveRootObjectKey];
        [un finishDecoding];
        if ([root isKindOfClass:[NSAttributedString class]]) return root;
    } @catch (__unused NSException *e) {}

    // 2) 旧式 typed stream（NSArchiver/NSUnarchiver）
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdeprecated-declarations"
    @try {
        id legacy = [NSUnarchiver unarchiveObjectWithData:data];
        if ([legacy isKindOfClass:[NSAttributedString class]]) return legacy;

        if ([legacy isKindOfClass:[NSDictionary class]]) {
            NSDictionary *d = legacy;
            NSString *s = d[@"string"] ?: d[@"_string"];
            NSDictionary *attrs = d[@"attributes"] ?: d[@"_attributes"];
            if (s) return [[NSAttributedString alloc] initWithString:s
                                                          attributes:[attrs isKindOfClass:[NSDictionary class]] ? attrs : nil];
        }
    } @catch (__unused NSException *e) {}
#pragma clang diagnostic pop

    // 3) 兜底：RTF / HTML
    NSDictionary *docAttrs = nil;
    NSAttributedString *rtf =
    [[NSAttributedString alloc] initWithData:data
                                     options:@{NSDocumentTypeDocumentOption: NSRTFTextDocumentType}
                          documentAttributes:&docAttrs
                                       error:nil];
    if (rtf.length > 0) return rtf;

    NSAttributedString *html =
    [[NSAttributedString alloc] initWithData:data
                                     options:@{NSDocumentTypeDocumentOption: NSHTMLTextDocumentType}
                          documentAttributes:&docAttrs
                                       error:nil];
    if (html.length > 0) return html;

    return nil;
}

int main(int argc, const char * argv[]) {
    @autoreleasepool {
        // 你的原始 Base64：
        NSString *b64 =
        @"BAtzdHJlYW10eXBlZIHoA4QBQISEhBlOU011dGFibGVBdHRyaWJ1dGVkU3RyaW5nAISEEk5TQXR0cmlidXRlZFN0cmluZwCEhAhOU09iamVjdACFkoSEhA9OU011dGFibGVTdHJpbmcBhIQITlNTdHJpbmcBlYQBKwdBYmRyaGhohoQCaUkBB5KEhIQMTlNEaWN0aW9uYXJ5AJWEAWkBkoSYmB1fX2tJTU1lc3NhZ2VQYXJ0QXR0cmlidXRlTmFtZYaShISECE5TTnVtYmVyAISEB05TVmFsdWUAlYQBKoSbmwCGhoY=";

        NSData *data = [[NSData alloc] initWithBase64EncodedString:b64
                                                          options:NSDataBase64DecodingIgnoreUnknownCharacters];
        if (!data) { NSLog(@"Base64 解码失败"); return 1; }

        NSLog(@"decoded bytes = %lu", (unsigned long)data.length);

        // 简单打印头 16 字节，方便确认“streamtyped”
        const unsigned char *p = data.bytes;
        NSUInteger n = MIN((NSUInteger)16, data.length);
        NSMutableString *head = [NSMutableString string];
        for (NSUInteger i = 0; i < n; i++) [head appendFormat:@"%02x ", p[i]];
        NSLog(@"head16 = %@", head);

        NSAttributedString *attr = DecodeFromData(data);
        DumpAttributedString(attr);
    }
    return 0;
}
