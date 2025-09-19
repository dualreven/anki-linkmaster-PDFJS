from ai_log.handlers.base import BaseHandler, FORUM_DIR
from ai_log.repositories.file_finder import find_by_timestamp_or_name
from ai_log.utils.text_input import normalize_forum_content, split_lines_preserve, read_text_from_file
from ai_log.services.forum_service import ForumService, AddCommentInput


class ForumHandler(BaseHandler):
    def __init__(self):
        super().__init__()
        self.service = ForumService()

    def find_forum_file(self, timestamp_or_name):
        return find_by_timestamp_or_name(
            FORUM_DIR,
            timestamp_or_name,
            ts_pattern="{ts}-forum*.json",
            name_pattern="*-forum-{name}.json",
        )

    def create(self, args):
        if not hasattr(args, 'forum_name') or not args.forum_name:
            print("❌ 必须提供forum_name参数")
            return
        user = args.user if hasattr(args, 'user') and args.user else "creator"
        ts_override = args.forum if hasattr(args, 'forum') and str(args.forum).isdigit() and len(str(args.forum)) == 14 else None
        project_name = getattr(args, 'project_name', None)
        initiator = getattr(args, 'initiator', None)
        if not (project_name and initiator):
            print("❌ 创建 forum 需要 --project-name 与 --initiator")
            return
        timestamp = self.service.create(args.forum_name, user, ts_override, project_name, initiator)
        filename = f"{FORUM_DIR}/{timestamp}-forum.json"
        print(f"✅ Forum记录创建成功: {filename}")

    def write_comment(self, args):
        content_arg = getattr(args, 'content', '')
        if hasattr(args, 'content_from_file') and args.content_from_file:
            try:
                content_arg = read_text_from_file(args.content_from_file)
            except Exception as e:
                print(f"❌ 读取文件失败: {e}")
                return
        content = normalize_forum_content(content_arg, hasattr(args, 'multiline') and args.multiline)
        if not content or not content.strip():
            print("❌ 评论内容不能为空\n提示: 使用 --content 或 --content-from-file 二选一；多行可用 --multiline 交互输入。")
            return
        content_lines = split_lines_preserve(content)
        user = args.user if hasattr(args, 'user') and args.user else "anonymous"
        reply_to = args.reply_to if hasattr(args, 'reply_to') else None
        try:
            agree_val = None
            if hasattr(args, 'agree') and args.agree in ('true','false','null'):
                agree_val = True if args.agree == 'true' else False if args.agree == 'false' else None
            resources = args.resource if hasattr(args, 'resource') and args.resource else []
            message_id = self.service.add_comment(AddCommentInput(
                forum_key=args.forum,
                user=user,
                lines=content_lines,
                reply_to=reply_to,
            ), agree=agree_val, resource=resources)
        except FileNotFoundError as e:
            print(f"❌ {e}\n提示: 请确认 14 位时间戳是否正确，或先执行 create。")
            return
        print(f"✅ 评论添加成功: {message_id}")

    def read_latest_reply(self, args):
        forum_file = self.find_forum_file(args.forum)
        if not forum_file:
            print(f"❌ 找不到forum记录: {args.forum}")
            print("请确认文件ID是否正确，若未创建请先使用create命令创建")
            return
        data = self.read_json(forum_file)
        if data and 'forumDiscussionRecord' in data:
            record = data['forumDiscussionRecord']
            content = record.get('discussionContent', [])
            if not content:
                print("❌ 没有找到回复内容")
                return
            latest = content[-1]
            print(latest)
            return
        if not data or not data.get('discussion_content'):
            print("❌ 没有找到回复内容")
            return
        latest_reply = data['discussion_content'][-1]
        print(latest_reply)

    def read_by_message_id(self, args):
        forum_file = self.find_forum_file(args.forum)
        if not forum_file:
            print(f"❌ 找不到forum记录: {args.forum}\n提示: 请确认时间戳是否正确，或先执行 create。")
            return
        data = self.read_json(forum_file)
        if not data:
            print("❌ 数据格式无效")
            return
        record = data.get('forumDiscussionRecord')
        if record and isinstance(record, dict):
            target = args.message_id.lstrip('#') if hasattr(args, 'message_id') else None
            for item in record.get('discussionContent', []) or []:
                mid = str(item.get('messageId', '')).lstrip('#')
                if mid == target:
                    print(item)
                    return
            print(f"❌ 未找到指定 messageId: {args.message_id}")
            return
        for item in data.get('discussion_content', []) or []:
            if item.get('message_id') == args.message_id or item.get('message_id') == f"#{args.message_id}":
                print(item)
                return
        print(f"❌ 未找到指定 message_id: {args.message_id}\n提示: 使用 001 或 #001 格式均可。")

    def read_is_agree(self, args):
        forum_file = self.find_forum_file(args.forum)
        if not forum_file:
            print(f"❌ 找不到forum记录: {args.forum}")
            return
        data = self.read_json(forum_file)
        if not data:
            print("❌ 数据格式无效")
            return
        record = data.get('forumDiscussionRecord')
        if record and isinstance(record, dict):
            content = record.get('discussionContent', []) or []
            if not content:
                print("❌ 没有讨论内容")
                return
            latest = content[-1]
            print(latest.get('agree', None))
            return
        if not data.get('discussion_content'):
            print("❌ 没有讨论内容")
            return
        latest = data['discussion_content'][-1]
        print(latest.get('agree', None))

    def read_status(self, args):
        forum_file = self.find_forum_file(args.forum)
        if not forum_file:
            print(f"❌ 找不到forum记录: {args.forum}")
            return
        data = self.read_json(forum_file)
        if not data:
            print("❌ 数据格式无效")
            return
        record = data.get('forumDiscussionRecord')
        if record and isinstance(record, dict):
            print((record.get('metadata') or {}).get('status', None))
            return
        print(data.get('metadata', {}).get('status', None))

    def update_status(self, args):
        forum_file = self.find_forum_file(args.forum)
        if not forum_file:
            print(f"❌ 找不到forum记录: {args.forum}")
            return
        data = self.read_json(forum_file)
        if not data:
            print("❌ 数据格式无效")
            return
        try:
            new_status = int(args.status) if hasattr(args, 'status') else None
        except Exception:
            print("❌ 状态无效，需为 0 或 1")
            return
        record = data.get('forumDiscussionRecord')
        if record and isinstance(record, dict):
            meta = record.setdefault('metadata', {})
            meta['status'] = new_status
            self.write_json(forum_file, data)
            print("ok")
            return
        data.setdefault('metadata', {})['status'] = new_status
        self.write_json(forum_file, data)
        print("ok")


