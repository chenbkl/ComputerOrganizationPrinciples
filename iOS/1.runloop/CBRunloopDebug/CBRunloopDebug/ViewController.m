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
    
//    NSThread *thread = [[NSThread alloc]initWithBlock:^{
//        NSRunLoop *runloop = [NSRunLoop currentRunLoop];
//        [NSTimer scheduledTimerWithTimeInterval:1.0 repeats:YES block:^(NSTimer * _Nonnull timer) {
//            NSLog(@"执行定时器任务");
//        }];
//        NSLog(@"runloop开始循环");
//        [runloop run];
//        NSLog(@"runloop退出，线程退出");
//    }];
//    [thread start];
}


- (IBAction)click:(id)sender {
    CBViewController *vc = [[CBViewController alloc]init];
    [self.navigationController pushViewController:vc animated:YES];
//    dispatch_async(dispatch_get_main_queue(), ^{
//        NSLog(@"GCD BLOCK");
//    });
//    NSRunLoop *runloop = [NSRunLoop currentRunLoop];
//    [runloop performBlock:^{
//        NSLog(@"runloop performBlock");
//    }];
}


@end
