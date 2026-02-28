const https = require('https');
const fs = require('fs');

const generateXhsQrcode = async () => {
  const timestamp = Date.now();
  const deviceFingerprint = 'de11af89e5bc45d6be1fb5f8d6a5f88f';

  const postData = JSON.stringify({});

  const options = {
    hostname: 'edith.xiaohongshu.com',
    port: 443,
    path: `/api/sns/web/v1/login/qrcode/create?device_fingerprint=${deviceFingerprint}&timestamp=${timestamp}`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
      'Referer': 'https://www.xiaohongshu.com/',
      'Origin': 'https://www.xiaohongshu.com',
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Cookie': `abRequestId=${deviceFingerprint}; webId=${deviceFingerprint}`
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve(result);
        } catch (e) {
          reject(new Error('Failed to parse response'));
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
};

generateXhsQrcode()
  .then(result => {
    if (result.success && result.data) {
      const qrcodeUrl = result.data.qrcode_link || result.data.qrcodeUrl || result.data.code_content;
      const codeId = result.data.code_id || result.data.codeId;
      
      if (qrcodeUrl) {
        console.log('===== 小红书登录二维码 =====');
        console.log('QR Code URL:', qrcodeUrl);
        console.log('Code ID:', codeId);
        console.log('\n请用手机小红书App扫描以下二维码登录：');
        console.log('\n' + qrcodeUrl);
        console.log('\n或者访问以下页面获取二维码图片：');
        console.log('https://cli.im/api/qrcode/code?text=' + encodeURIComponent(qrcodeUrl));
        
        // 保存二维码信息到文件
        fs.writeFileSync('xhs_qrcode_url.txt', qrcodeUrl);
        fs.writeFileSync('xhs_code_id.txt', codeId);
        
      } else {
        console.log('API响应:', JSON.stringify(result, null, 2));
      }
    } else {
      console.log('API请求失败:', JSON.stringify(result, null, 2));
    }
  })
  .catch(err => {
    console.error('Error:', err.message);
  });
