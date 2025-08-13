
// save as tiny.c
#include <stdio.h>
#include <unistd.h>
#include <fcntl.h>

int main() {
  while (1) {
    int fd = open("/etc/hosts", O_RDONLY);
    if (fd >= 0) close(fd);
    usleep(300000); // 0.3s
  }
}
