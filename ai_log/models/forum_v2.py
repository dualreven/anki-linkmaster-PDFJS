from typing import Any, Dict, List, Optional
from ai_log.utils.time_id import now_iso


def build_forum_v2(project_name: str, initiator: str, created_at: Optional[str] = None) -> Dict[str, Any]:
    """构建符合文档规范的 forumDiscussionRecord v2 结构。

    - metadata.status: 数字 0/1，默认 0
    - participants: 预置发起人参与者
    - discussionTopic: 默认使用项目名（若无单独字段）
    - discussionContent: 空数组
    """
    return {
        "forumDiscussionRecord": {
            "metadata": {
                "project": project_name,
                "initiator": initiator,
                "createdAt": created_at or now_iso(),
                "status": 0,
            },
            "participants": [
                {
                    "user": initiator,
                    "role": "initiator",
                }
            ],
            "discussionTopic": project_name,
            "discussionContent": [],
            "unresolvedItems": "",
            "consensusAgreements": "",
        }
    }


def append_message_v2(data: Dict[str, Any], user: str, content: str, reply_to: Optional[str], agree: Optional[Any], resource: Optional[List[str]]) -> str:
    record = data.setdefault("forumDiscussionRecord", {})
    content_list: List[Dict[str, Any]] = record.setdefault("discussionContent", [])
    message_id = f"{len(content_list) + 1:03d}"
    message: Dict[str, Any] = {
        "messageId": message_id,
        "user": user,
        "time": now_iso(),
        "replyTo": reply_to if reply_to else None,
        "agree": agree if agree in (True, False, None) else None,
        "content": content,
        "resource": resource or [],
    }
    content_list.append(message)
    return message_id


