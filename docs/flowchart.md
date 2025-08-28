# 原型迭代开发流程图

```mermaid
graph TD
    A[需求对齐] --> B[创建分支]

    subgraph Proto [原型迭代开发循环]
        B --> C[架构生成/调整]
        subgraph Arch [架构设计循环]
            C --> D[规范生成/调整]
            D --> E[冲突检测/调整]
            E --> C
        end
        E --> F[用例生成]
        F --> G[任务原子化]
        G --> H[任务分组]
        H --> I[测试文件生成]
        I --> J[代码生成]
        subgraph TDD [测试驱动开发循环]
            J --> K[测试验证]
            K --> L[规范验证]
            L --> J
        end
        L --> M[验收合并]
        M --> B
    end