IMAGE_NAME=iosappdelivery
# 手动指定版本
VERSION=1.0.5
COMPOSE_FILE=docker-compose.test.yml
IMAGE_FILE=$(IMAGE_NAME)_$(VERSION).tar
x86_PLATFORM=linux/amd64   # 强制构建 amd64 架构，兼容服务器
arm64_PLATFORM=linux/arm64   # 强制构建 amd64 架构，兼容服务器

build_x86:
	docker build --platform $(x86_PLATFORM) -t $(IMAGE_NAME):$(VERSION) -t $(IMAGE_NAME):latest .
	docker save -o $(IMAGE_FILE) $(IMAGE_NAME):$(VERSION)

build_arm:
	docker build --platform $(arm64_PLATFORM) -t $(IMAGE_NAME):$(VERSION) -t $(IMAGE_NAME):latest .
	docker save -o $(IMAGE_FILE) $(IMAGE_NAME):$(VERSION)

# 用 compose 启动服务
up:
	docker compose -f $(COMPOSE_FILE) up -d

# 清理本地镜像和容器
clean:
	docker rm -f $(IMAGE_NAME) || true
	docker rmi $(IMAGE_NAME):$(VERSION) $(IMAGE_NAME):latest || true
	rm -f $(IMAGE_FILE)