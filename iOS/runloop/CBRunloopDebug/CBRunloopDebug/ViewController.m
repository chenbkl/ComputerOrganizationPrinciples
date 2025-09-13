//
//  ViewController.m
//  CBRunloopDebug
//
//  Created by chenbin on 9/13/25.
//

#import "ViewController.h"
#import "CBViewController.h"

@interface ViewController ()

@end

@implementation ViewController

- (void)viewDidLoad {
    [super viewDidLoad];
    
    NSThread *thread = [[NSThread alloc]initWithBlock:^{
        NSRunLoop *runloop = [NSRunLoop currentRunLoop];
//        NSLog(@"%@",runloop);
        NSLog(@"当前线程是：%@",[NSThread currentThread]);
        CFRunLoopRef rl = CFRunLoopGetCurrent();
        CFShow(rl);
        [runloop addPort:[NSMachPort port] forMode:NSDefaultRunLoopMode];
        [runloop run];
    }];
    [thread start];
    CFRunLoopRef runloop = CFRunLoopGetMain();
    CFShow(runloop);
    
}
- (IBAction)click:(id)sender {
    
    CBViewController *vc = [[CBViewController alloc]init];
    [self.navigationController pushViewController:vc animated:YES];
    
}


@end
