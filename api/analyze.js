export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { image, promptText } = req.body;
  const apiKey = process.env.DASHSCOPE_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: '云端配置错误：未找到 API Key' });
  }

  try {
    const dashScopeRes = await fetch("https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation", {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'qwen-vl-max',
        input: {
          messages: [
            {
              role: "user",
              content: [
                { image: image },
                { text: promptText }
              ]
            }
          ]
        }
      })
    });

    const data = await dashScopeRes.json();
    
    if (!dashScopeRes.ok) {
      return res.status(dashScopeRes.status).json({ error: data.message || '阿里云接口返回错误' });
    }

    return res.status(200).json(data);
    
  } catch (error) {
    return res.status(500).json({ error: error.message || '服务器内部错误' });
  }
}
