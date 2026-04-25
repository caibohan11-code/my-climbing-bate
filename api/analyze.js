export default async function handler(req, res) {
  // 只允许 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 接收前端传来的图片和操作类型
  const { image, promptText, action } = req.body;
  
  // 核心机密：从 Vercel 保险箱里读取 API Key
  const apiKey = process.env.DASHSCOPE_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: '服务端服务器未配置 API Key，请在 Vercel 环境变量中设置。' });
  }

  try {
    // 根据 action 决定使用的 prompt
    let finalPrompt = promptText;

    if (action === 'auto-detect') {
      // AI 自动识别岩点：坐标 + 类型
      finalPrompt = `你是一位专业的攀岩路线分析 AI。请仔细分析这张攀岩墙图片，完成以下任务：

1. 识别出图片中所有岩点（holds）的位置坐标
2. 判断每个岩点的类型（Hold Type）

请以 **严格的 JSON 数组格式** 返回结果，不要包含任何其他文字说明。返回格式如下：

[
  {
    "x": 坐标X（相对于图片宽度的百分比，0-100之间的数字）,
    "y": 坐标Y（相对于图片高度的百分比，0-100之间的数字）,
    "type": "岩点类型"
  },
  ...
]

岩点类型（Hold Type）请从以下分类中选择：
- "Jug" — 大把手点，容易抓握
- "Crimp" — 指力窝/抠点，仅能容纳指尖
- "Sloper" — 大斜面/坡面点，靠摩擦力
- "Pinch" — 捏点，需要用拇指和手指对捏
- "Pocket" — 洞点，仅能插入几根手指

注意事项：
- x 和 y 是百分比数值（0-100），不要带单位
- 请尽可能识别所有可见的岩点
- 如果某个岩点类型不确定，选择最接近的类型
- 只返回 JSON 数组，不要有任何其他内容`;
    }

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
                { text: finalPrompt }
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

    // 如果是 auto-detect 模式，尝试解析 AI 返回的 JSON
    if (action === 'auto-detect') {
      try {
        const rawText = data.output?.text || 
          data.output?.choices?.[0]?.message?.content ||
          '';
        const textContent = typeof rawText === 'string' ? rawText : 
          (Array.isArray(rawText) ? rawText.map(x => x.text || '').join('') : '');
        
        // 尝试从返回文本中提取 JSON 数组
        const jsonMatch = textContent.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return res.status(200).json({ success: true, points: parsed, raw: textContent });
        }
        
        // 如果没找到 JSON 数组，返回原始文本让前端处理
        return res.status(200).json({ success: true, points: null, raw: textContent });
      } catch (parseError) {
        return res.status(200).json({ success: true, points: null, raw: data.output?.text || JSON.stringify(data) });
      }
    }

    // 非 auto-detect 模式：将结果原封不动返回给前端
    return res.status(200).json(data);
    
  } catch (error) {
    return res.status(500).json({ error: error.message || '服务器内部错误' });
  }
}
