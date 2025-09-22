
# 这个类主要打包任务管理
# 采用队列的形式管理，先进先出
# 提供添加任务，删除任务，查看任务列表等功能




class TaskManage:
    def __init__(self):
        self.tasks = []

    def add_task(self, task):
        """添加任务到队列"""
        self.tasks.append(task)

    def remove_task(self, task):
        """从队列中删除任务"""
        if task in self.tasks:
            self.tasks.remove(task)

    def get_tasks(self):
        """获取当前任务列表"""
        return self.tasks

    def clear_tasks(self):
        """清空任务队列"""
        self.tasks = []


