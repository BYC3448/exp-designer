require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');
const { StringDecoder } = require('string_decoder');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 정적 파일 제공 설정
app.use(express.static(__dirname, {
    dotfiles: 'ignore',
    etag: false,
    extensions: ['htm', 'html', 'css', 'js'],
    index: false,
    maxAge: '1d',
    redirect: false,
    setHeaders: function (res, path, stat) {
        res.set('x-timestamp', Date.now())
    }
}));

// 루트 경로에서 index.html 제공
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Gemini API 엔드포인트
app.post('/api/gemini/generate', async (req, res) => {
    try {
        const { messages } = req.body;
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            throw new Error('Gemini API 키가 설정되지 않았습니다.');
        }

        // 마지막 사용자 메시지 가져오기
        const lastUserMessage = messages.filter(msg => msg.role === 'user').pop();
        
        const requestBody = {
            contents: [
                {
                    parts: [
                        {
                            text: lastUserMessage.content
                        }
                    ]
                }
            ],
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 6000
            }
        };

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:streamGenerateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Gemini API 요청 실패: ${errorText}`);
        }

        // SSE 응답 헤더 설정
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const reader = response.body;
        const decoder = new StringDecoder('utf8');
        let buffer = '';

        reader.on('data', (chunk) => {
            buffer += decoder.write(chunk);
            
            let braceCount = 0;
            let startIndex = -1;
            
            for (let i = 0; i < buffer.length; i++) {
                if (buffer[i] === '{') {
                    if (braceCount === 0) startIndex = i;
                    braceCount++;
                } else if (buffer[i] === '}') {
                    braceCount--;
                    if (braceCount === 0 && startIndex !== -1) {
                        const jsonStr = buffer.slice(startIndex, i + 1);
                        try {
                            const obj = JSON.parse(jsonStr);
                            if (obj.candidates && obj.candidates.length > 0) {
                                const text = obj.candidates[0].content?.parts?.[0]?.text || '';
                                if (text) {
                                    res.write(`data: ${JSON.stringify({ text })}\n\n`);
                                }
                            }
                        } catch (e) {
                            // JSON 파싱 실패 시 버퍼 유지하고 다음 기회 대기
                        }
                        buffer = buffer.slice(i + 1);
                        i = -1; // 루프 변수 리셋
                        startIndex = -1;
                    }
                }
            }
        });

        reader.on('end', () => {
            buffer += decoder.end();
            res.write('data: [DONE]\n\n');
            res.end();
        });

        reader.on('error', (err) => {
            console.error('Stream error:', err);
            res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
            res.end();
        });
    } catch (error) {
        console.error('Gemini API 오류:', error);
        // 이미 헤더가 전송된 경우 에러 바디 전송 불가
        if (!res.headersSent) {
            res.status(500).json({ error: error.message });
        }
    }
});

// YouTube 검색 API 엔드포인트
app.post('/api/youtube/search', async (req, res) => {
    try {
        const { query, pageToken, maxResults = 12 } = req.body;
        const apiKey = process.env.YOUTUBE_API_KEY;

        if (!apiKey) {
            throw new Error('YouTube API 키가 설정되지 않았습니다.');
        }

        // pageToken이 있으면 추가
        const pageTokenParam = pageToken ? `&pageToken=${pageToken}` : '';
        const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=${maxResults}${pageTokenParam}&key=${apiKey}`;
        
        console.log('YouTube API 요청:', url); // 디버깅용 로그

        const response = await fetch(url);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('YouTube API 오류 응답:', errorText);
            throw new Error(`YouTube API 요청 실패: ${errorText}`);
        }

        const data = await response.json();
        console.log('YouTube API 응답:', JSON.stringify(data, null, 2)); // 디버깅용 로그
        
        if (!data.items || !Array.isArray(data.items)) {
            throw new Error('YouTube API 응답 형식이 올바르지 않습니다.');
        }

        // 원본 데이터 구조 유지 (video.js에서 사용)
        res.json(data);
    } catch (error) {
        console.error('YouTube 검색 중 오류:', error);
        res.status(500).json({ error: error.message });
    }
});

// YouTube 영상 상세 정보 API 엔드포인트
app.post('/api/youtube/details', async (req, res) => {
    try {
        const { videoId } = req.body;
        const apiKey = process.env.YOUTUBE_API_KEY;

        if (!apiKey) {
            throw new Error('YouTube API 키가 설정되지 않았습니다.');
        }

        if (!videoId) {
            throw new Error('비디오 ID가 필요합니다.');
        }

        const url = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,statistics&id=${videoId}&key=${apiKey}`;
        
        console.log('YouTube 상세정보 API 요청:', url); // 디버깅용 로그

        const response = await fetch(url);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('YouTube 상세정보 API 오류 응답:', errorText);
            throw new Error(`YouTube 상세정보 API 요청 실패: ${errorText}`);
        }

        const data = await response.json();
        console.log('YouTube 상세정보 API 응답:', JSON.stringify(data, null, 2)); // 디버깅용 로그
        
        res.json(data);
    } catch (error) {
        console.error('YouTube 상세정보 조회 중 오류:', error);
        res.status(500).json({ error: error.message });
    }
});

if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    const PORT = process.env.PORT || 8000;
    app.listen(PORT, () => {
        console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
    });
}

module.exports = app; 