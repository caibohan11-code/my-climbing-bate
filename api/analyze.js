export default async function handler(req, res) {
  // 只允许 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 接收前端传来的图片、操作类型和坐标点数据
  const { image, promptText, action, points: userPoints } = req.body;
  
  // 核心机密：从 Vercel 保险箱里读取 API Key
  const apiKey = process.env.DASHSCOPE_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: '服务端服务器未配置 API Key，请在 Vercel 环境变量中设置。' });
  }

  try {
    // 根据 action 决定使用的 prompt
    let finalPrompt = promptText;

    if (action === 'analyze-points') {
      // 构建坐标点描述文本
      const pointsDesc = (userPoints || []).map(function(p, i) {
        return '点' + (i + 1) + '：坐标 (' + Math.round(p.x) + ', ' + Math.round(p.y) + ')';
      }).join('\n');

      finalPrompt = `你是一个顶级的定线员和攀岩教练。用户已经在攀岩墙图片上标记了若干个岩点（附带坐标），请根据图片，逐一分析这些指定坐标位置的岩点。

用户标记的点位如下：
${pointsDesc}

请以 **严格的 JSON 数组格式** 返回结果，不要包含任何其他文字说明。返回格式如下：

[
  {
    "id": 1,
    "limb_type": "手点",
    "hold_type": "Jug(大把手)",
    "direction": "上"
  },
  ...
]

字段说明：
- id: 对应前端传来的点位序号（从 1 开始）
- limb_type: 必须是 "手点" 或 "脚点" 之一
- hold_type: 
  * 如果 limb_type 是 "手点"，必须从以下分类中选择一种：
    - "Jug(大把手)" — 大把手点，容易抓握
    - "Crimp(抠点/指力窝)" — 仅能容纳指尖的抠点
    - "Sloper(斜面)" — 大斜面/坡面点，靠摩擦力
    - "Pinch(捏点)" — 需要用拇指和手指对捏
    - "Pocket(洞点)" — 仅能插入几根手指的洞点
    - "Volume(大木盒)" — 大型造型点
  * 如果 limb_type 是 "脚点"，hold_type 固定填 "Foot"
- direction: 岩点主要的发力/开口方向，从以下分类中选择一种：
  "上", "下", "左", "右", "左上", "右上", "左下", "右下", "无明显方向"

注意事项：
- 请仔细观察图片中每个坐标点位置的岩点形态
- 如果某个属性不确定，根据岩点外观选择最合理的值
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

    // 如果是 analyze-points 模式，尝试解析 AI 返回的 JSON
    if (action === 'analyze-points') {
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
          return res.status(200).json({ success: true, analysis: parsed, raw: textContent });
        }
        
        // 如果没找到 JSON 数组，返回原始文本让前端处理
        return res.status(200).json({ success: true, analysis: null, raw: textContent });
      } catch (parseError) {
        return res.status(200).json({ success: true, analysis: null, raw: data.output?.text || JSON.stringify(data) });
      }
    }

    // 非 analyze-points 模式（Beta 生成）：将结果原封不动返回给前端
    return res.status(200).json(data);
    
  } catch (error) {
    return res.status(500).json({ error: error.message || '服务器内部错误' });
  }
}
