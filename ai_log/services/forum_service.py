from dataclasses import dataclass
from typing import List
from ai_log.repositories.forum_repository import ForumRepository
from ai_log.utils.time_id import now_compact_ts, now_iso
from ai_log.models.forum_v2 import build_forum_v2, append_message_v2


@dataclass
class AddCommentInput:
    forum_key: str
    user: str
    lines: List[str]
    reply_to: str | None = None


class ForumService:
    def __init__(self, repo: ForumRepository | None = None) -> None:
        self.repo = repo or ForumRepository()

    def create(self, name: str, user: str, ts: str | None = None, project_name: str | None = None, initiator: str | None = None) -> str:
        ts = ts or now_compact_ts()
        # 强制 v2
        if not (project_name and initiator):
            raise ValueError("创建 forum 需要 --project-name 与 --initiator")
        data = build_forum_v2(project_name=project_name, initiator=initiator, created_at=now_iso())
        self.repo.save_new(ts, data)
        return ts

    def add_comment(self, payload: AddCommentInput, agree=None, resource=None) -> str:
        file_path = self.repo.find_file(payload.forum_key)
        if not file_path:
            raise FileNotFoundError(f"找不到forum记录: {payload.forum_key}")
        forum = self.repo.load(file_path)
        if not forum:
            raise FileNotFoundError(f"找不到forum文件: {file_path}")
        # v2 only
        if "forumDiscussionRecord" not in forum:
            raise ValueError("forum 文件不是 v2 结构: 缺少 forumDiscussionRecord")
        content = "\n".join(payload.lines)
        record = forum["forumDiscussionRecord"]
        dc = record.get("discussionContent", [])
        # 默认回复上一条
        effective_reply_to = payload.reply_to
        if not effective_reply_to and dc:
            effective_reply_to = dc[-1].get("messageId")
        mid = append_message_v2(forum, payload.user or "anonymous", content, effective_reply_to, agree, resource or [])
        self.repo.save(file_path, forum)
        return f"#{mid}"


