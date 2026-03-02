"""
企业微信API客户端
"""
import requests
import time
from typing import Optional, Dict, Any


class WeComClient:
    def __init__(self, corpid: str, secret: str, agentid: int):
        self.corpid = corpid
        self.secret = secret
        self.agentid = agentid
        self.access_token = None
        self.token_expires_at = 0
        self.base_url = "https://qyapi.weixin.qq.com"

    def get_access_token(self) -> str:
        """获取访问令牌"""
        # 如果令牌还有效，直接返回
        if self.access_token and time.time() < self.token_expires_at:
            return self.access_token

        url = f"{self.base_url}/cgi-bin/gettoken"
        params = {
            "corpid": self.corpid,
            "corpsecret": self.secret
        }

        response = requests.get(url, params=params, timeout=10)
        result = response.json()

        if result.get("errcode") != 0:
            raise Exception(f"获取access_token失败: {result.get('errmsg')}")

        self.access_token = result["access_token"]
        self.token_expires_at = time.time() + result["expires_in"] - 300  # 提前5分钟过期
        return self.access_token

    def send_text_message(
        self,
        content: str,
        to_user: Optional[str] = None,
        to_party: Optional[str] = None,
        to_tag: Optional[str] = None
    ) -> Dict[str, Any]:
        """发送文本消息"""
        token = self.get_access_token()
        url = f"{self.base_url}/cgi-bin/message/send?access_token={token}"

        data = {
            "msgtype": "text",
            "agentid": self.agentid,
            "text": {
                "content": content
            }
        }

        if to_user:
            data["touser"] = to_user
        if to_party:
            data["toparty"] = to_party
        if to_tag:
            data["totag"] = to_tag

        response = requests.post(url, json=data, timeout=10)
        return response.json()

    def send_markdown_message(
        self,
        content: str,
        to_user: Optional[str] = None,
        to_party: Optional[str] = None,
        to_tag: Optional[str] = None
    ) -> Dict[str, Any]:
        """发送Markdown消息"""
        token = self.get_access_token()
        url = f"{self.base_url}/cgi-bin/message/send?access_token={token}"

        data = {
            "msgtype": "markdown",
            "agentid": self.agentid,
            "markdown": {
                "content": content
            }
        }

        if to_user:
            data["touser"] = to_user
        if to_party:
            data["toparty"] = to_party
        if to_tag:
            data["totag"] = to_tag

        response = requests.post(url, json=data, timeout=10)
        return response.json()

    def send_image_message(
        self,
        media_id: str,
        to_user: Optional[str] = None,
        to_party: Optional[str] = None,
        to_tag: Optional[str] = None
    ) -> Dict[str, Any]:
        """发送图片消息"""
        token = self.get_access_token()
        url = f"{self.base_url}/cgi-bin/message/send?access_token={token}"

        data = {
            "msgtype": "image",
            "agentid": self.agentid,
            "image": {
                "media_id": media_id
            }
        }

        if to_user:
            data["touser"] = to_user
        if to_party:
            data["toparty"] = to_party
        if to_tag:
            data["totag"] = to_tag

        response = requests.post(url, json=data, timeout=10)
        return response.json()

    def upload_media(self, file_path: str, media_type: str = "image") -> Dict[str, Any]:
        """上传临时素材"""
        token = self.get_access_token()
        url = f"{self.base_url}/cgi-bin/media/upload?access_token={token}&type={media_type}"

        with open(file_path, 'rb') as f:
            files = {'media': f}
            response = requests.post(url, files=files, timeout=30)

        return response.json()

    def send_webhook_message(self, webhook_key: str, content: Dict[str, Any]) -> Dict[str, Any]:
        """通过群机器人发送消息"""
        url = f"https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key={webhook_key}"
        response = requests.post(url, json=content, timeout=10)
        return response.json()