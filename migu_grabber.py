#!/usr/bin/env python3
"""
咪咕视频 ID/Token 抓取脚本
用法: python3 migu_grabber.py
"""

import requests
import re
import json
import sys
from urllib.parse import urlencode, parse_qs, urlparse

# 请求配置
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
}

def grab_from_html(url):
    """从 HTML 页面抓取 ID 和 Token"""
    try:
        session = requests.Session()
        response = session.get(url, headers=HEADERS, timeout=30)
        response.raise_for_status()
        html = response.text
        
        results = {
            'url': url,
            'cookies': dict(session.cookies),
            'ids': [],
            'tokens': [],
            'api_keys': [],
            'other_secrets': []
        }
        
        # 1. 查找常见的 ID 模式
        id_patterns = [
            # 视频/内容 ID
            (r'["\']contentId["\']\s*[:=]\s*["\']([^"\']+)["\']', 'contentId'),
            (r'["\']videoId["\']\s*[:=]\s*["\']([^"\']+)["\']', 'videoId'),
            (r'["\']cid["\']\s*[:=]\s*["\']([^"\']+)["\']', 'cid'),
            (r'["\']id["\']\s*[:=]\s*["\']([a-zA-Z0-9_-]{10,})["\']', 'generic_id'),
            # 数字ID
            (r'["\']contentId["\']\s*:\s*(\d+)', 'contentId_numeric'),
            (r'["\']videoId["\']\s*:\s*(\d+)', 'videoId_numeric'),
        ]
        
        for pattern, name in id_patterns:
            matches = re.findall(pattern, html)
            for match in set(matches):  # 去重
                results['ids'].append({'type': name, 'value': match})
        
        # 2. 查找 Token
        token_patterns = [
            (r'["\']token["\']\s*[:=]\s*["\']([a-zA-Z0-9_-]+\.?[a-zA-Z0-9_-]*)["\']', 'token'),
            (r'["\']accessToken["\']\s*[:=]\s*["\']([^"\']+)["\']', 'accessToken'),
            (r'["\']auth_token["\']\s*[:=]\s*["\']([^"\']+)["\']', 'auth_token'),
            (r'["\']authorization["\']\s*[:=]\s*["\']([^"\']+)["\']', 'authorization'),
            (r'Bearer\s+([a-zA-Z0-9_-]+)', 'bearer_token'),
        ]
        
        for pattern, name in token_patterns:
            matches = re.findall(pattern, html)
            for match in set(matches):
                if len(match) > 10:  # 过滤短字符串
                    results['tokens'].append({'type': name, 'value': match[:50] + '...' if len(match) > 50 else match})
        
        # 3. 查找 API Key
        api_patterns = [
            (r'["\']api[_-]?key["\']\s*[:=]\s*["\']([^"\']+)["\']', 'api_key'),
            (r'["\']app[_-]?key["\']\s*[:=]\s*["\']([^"\']+)["\']', 'app_key'),
            (r'["\']app[_-]?id["\']\s*[:=]\s*["\']([^"\']+)["\']', 'app_id'),
        ]
        
        for pattern, name in api_patterns:
            matches = re.findall(pattern, html, re.IGNORECASE)
            for match in set(matches):
                results['api_keys'].append({'type': name, 'value': match})
        
        # 4. 查找 JSON 数据块
        json_patterns = [
            r'window\.__INITIAL_STATE__\s*=\s*({.+?});',
            r'window\.__DATA__\s*=\s*({.+?});',
            r'window\.__config__\s*=\s*({.+?});',
        ]
        
        for pattern in json_patterns:
            matches = re.findall(pattern, html, re.DOTALL)
            for match in matches:
                try:
                    data = json.loads(match)
                    # 递归查找 id 和 token
                    find_in_json(data, results)
                except:
                    pass
        
        return results
        
    except Exception as e:
        return {'error': str(e)}

def find_in_json(obj, results, path=''):
    """递归查找 JSON 中的敏感字段"""
    if isinstance(obj, dict):
        for key, value in obj.items():
            new_path = f"{path}.{key}" if path else key
            
            # 检查 key 名称
            if any(x in key.lower() for x in ['id', 'token', 'key', 'secret', 'auth']):
                if isinstance(value, str) and len(value) > 5:
                    if 'token' in key.lower() or 'auth' in key.lower():
                        results['tokens'].append({'type': f'json:{new_path}', 'value': value[:50]})
                    elif 'id' in key.lower():
                        results['ids'].append({'type': f'json:{new_path}', 'value': value})
            
            # 递归
            if isinstance(value, (dict, list)):
                find_in_json(value, results, new_path)
                
    elif isinstance(obj, list):
        for i, item in enumerate(obj):
            find_in_json(item, results, f"{path}[{i}]")

def main():
    url = "https://www.miguvideo.com/"
    print(f"[*] 正在抓取: {url}")
    print("=" * 60)
    
    results = grab_from_html(url)
    
    if 'error' in results:
        print(f"[!] 错误: {results['error']}")
        sys.exit(1)
    
    # 显示结果
    print(f"\n[+] Cookies ({len(results['cookies'])}):")
    for k, v in results['cookies'].items():
        print(f"    {k}: {v[:30]}..." if len(str(v)) > 30 else f"    {k}: {v}")
    
    print(f"\n[+] IDs 找到 ({len(results['ids'])}):")
    for item in results['ids'][:10]:  # 最多显示10个
        print(f"    [{item['type']}] {item['value']}")
    
    print(f"\n[+] Tokens 找到 ({len(results['tokens'])}):")
    for item in results['tokens'][:10]:
        print(f"    [{item['type']}] {item['value']}")
    
    print(f"\n[+] API Keys 找到 ({len(results['api_keys'])}):")
    for item in results['api_keys']:
        print(f"    [{item['type']}] {item['value']}")
    
    # 保存完整结果
    output_file = '/tmp/migu_results.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"\n[*] 完整结果已保存: {output_file}")

if __name__ == '__main__':
    main()