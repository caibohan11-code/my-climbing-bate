{\rtf1\ansi\ansicpg936\cocoartf2822
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\paperw11900\paperh16840\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\pard\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0

\f0\fs24 \cf0 export default async function handler(req, res) \{\
  // \uc0\u21482 \u20801 \u35768  POST \u35831 \u27714 \
  if (req.method !== 'POST') \{\
    return res.status(405).json(\{ error: 'Method Not Allowed' \});\
  \}\
\
  // \uc0\u25509 \u25910 \u21069 \u31471 \u20256 \u26469 \u30340 \u22270 \u29255 \u21644 \u25552 \u31034 \u35789 \
  const \{ image, promptText \} = req.body;\
  \
  // \uc0\u26680 \u24515 \u26426 \u23494 \u65306 \u20174  Vercel \u20445 \u38505 \u31665 \u37324 \u35835 \u21462  API Key\
  const apiKey = process.env.DASHSCOPE_API_KEY;\
\
  if (!apiKey) \{\
    return res.status(500).json(\{ error: '\uc0\u20113 \u31471 \u26381 \u21153 \u22120 \u26410 \u37197 \u32622  API Key\u65292 \u35831 \u22312  Vercel \u29615 \u22659 \u21464 \u37327 \u20013 \u35774 \u32622 \u12290 ' \});\
  \}\
\
  try \{\
    // \uc0\u30001 \u21518 \u31471 \u21521 \u38463 \u37324 \u20113 \u21457 \u36215 \u35831 \u27714 \u65292 \u24443 \u24213 \u38544 \u34255 \u23494 \u30721 \
    const dashScopeRes = await fetch("https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation", \{\
      method: 'POST',\
      headers: \{\
        'Authorization': `Bearer $\{apiKey\}`,\
        'Content-Type': 'application/json'\
      \},\
      body: JSON.stringify(\{\
        model: 'qwen-vl-max',\
        input: \{\
          messages: [\
            \{\
              role: "user",\
              content: [\
                \{ image: image \},\
                \{ text: promptText \}\
              ]\
            \}\
          ]\
        \}\
      \})\
    \});\
\
    const data = await dashScopeRes.json();\
    \
    if (!dashScopeRes.ok) \{\
      return res.status(dashScopeRes.status).json(\{ error: data.message || '\uc0\u38463 \u37324 \u20113 \u25509 \u21475 \u36820 \u22238 \u38169 \u35823 ' \});\
    \}\
\
    // \uc0\u23558 \u32467 \u26524 \u21407 \u23553 \u19981 \u21160 \u36820 \u22238 \u32473 \u21069 \u31471 \
    return res.status(200).json(data);\
    \
  \} catch (error) \{\
    return res.status(500).json(\{ error: error.message || '\uc0\u26381 \u21153 \u22120 \u20869 \u37096 \u38169 \u35823 ' \});\
  \}\
\}}
