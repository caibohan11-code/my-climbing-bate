export default async function handler(req, res) {
  // 只允许 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 接收前端传来的图片、操作类型和坐标点数据
  const { image, promptText, action, points: userPoints, color: routeColor } = req.body;
  
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

      // 颜色参数：前端可能暂未发送，预留兼容
      const colorName = routeColor || '用户指定的颜色';

      finalPrompt = `你是一个顶级的定线员。当前用户正在攀爬一条特定颜色的路线（颜色参数为 ${colorName}）。

【三重交叉验证分析协议——必须严格遵守】

第一铁律（颜色绝对锁定）：请【完全忽略】图片中所有其他颜色的岩点、胶带、粉痕和背景！你只能盯着用户指定的这种颜色（${colorName}）看！

第二铁律（坐标锚定）：用户已经在图上标记了大致的岩点坐标位置，参考以下坐标数组：
${pointsDesc}

第三铁律（原图深度分析）：请务必结合用户上传的原图，在上述坐标点附近，找到对应颜色（${colorName}）的岩点。通过仔细观察它在原图中的真实三维形状、阴影和纹理，分析出它的专业属性。

请严格按 JSON 格式返回分析结果列表，每个点必须包含：

id: 对应的坐标标号

limb_type: "手点" 或 "脚点"

hold_type: 从以下类别中精准选择 [Jug(大把手), Crimp(抠点), Sloper(斜面), Pinch(捏点), Pocket(洞点), Volume(大木盒), Foot(脚点)]

direction: 发力/开口方向 [上, 下, 左, 右, 左上, 右上, 左下, 右下, 无]

返回格式示例（只返回 JSON 数组，不要有任何其他内容）：
[
  {
    "id": 1,
    "limb_type": "手点",
    "hold_type": "Jug(大把手)",
    "direction": "上"
  }
]`;
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
