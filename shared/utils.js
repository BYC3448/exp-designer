// utils.js - 공통 유틸리티 함수들

// 템플릿 문자열에 변수 삽입하는 함수
export function renderTemplate(template, variables) {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        return variables[key] !== undefined ? variables[key] : match;
    });
}

// 선수학습 내용을 텍스트로 포매팅하는 함수
export function formatPrerequisiteContent(prerequisites) {
    if (!prerequisites || prerequisites.length === 0) {
        return "선수학습 내용이 없습니다.";
    }

    let result = "";
    const grouped = {};

    // 학교급별로 그룹화
    prerequisites.forEach(pre => {
        if (!grouped[pre.schoolLevel]) {
            grouped[pre.schoolLevel] = {};
        }

        if (!grouped[pre.schoolLevel][pre.gradeGroup]) {
            grouped[pre.schoolLevel][pre.gradeGroup] = {};
        }

        if (!grouped[pre.schoolLevel][pre.gradeGroup][pre.subject]) {
            grouped[pre.schoolLevel][pre.gradeGroup][pre.subject] = {};
        }

        grouped[pre.schoolLevel][pre.gradeGroup][pre.subject][pre.unit] = pre.contentElements;
    });

    // 그룹화된 데이터를 텍스트로 변환
    for (const schoolLevel in grouped) {
        for (const gradeGroup in grouped[schoolLevel]) {
            result += `- ${schoolLevel} ${gradeGroup}:\n`;

            for (const subject in grouped[schoolLevel][gradeGroup]) {
                for (const unit in grouped[schoolLevel][gradeGroup][subject]) {
                    const elements = grouped[schoolLevel][gradeGroup][subject][unit];
                    result += `  - ${unit}: ${elements.join(', ')}\n`;
                }
            }
        }
    }

    return result;
}

// 마크다운을 HTML로 변환하는 함수
// LaTeX 수식을 일반 텍스트 및 유니코드 기호로 강제 변환(정화)하는 헬퍼 함수
function sanitizeLatex(text) {
    if (!text) return '';

    let sanitized = text;

    // 1. \left| / \right| 등 절댓값 표시 정화 (백슬래시 지우기 전에 먼저 처리)
    sanitized = sanitized.replace(/\\left\|/g, '|').replace(/\\right\|/g, '|');
    sanitized = sanitized.replace(/left\|/g, '|').replace(/right\|/g, '|');

    // 2. \frac{A}{B} -> A / B 변환 (백슬래시와 frac 모두 잡음)
    sanitized = sanitized.replace(/\\frac\{([^\}]+)\}\{([^\}]+)\}/g, '$1 / $2');
    sanitized = sanitized.replace(/frac\{([^\}]+)\}\{([^\}]+)\}/g, '$1 / $2');

    // 3. \text{한글} -> 한글 변환
    sanitized = sanitized.replace(/\\text\{([^\}]+)\}/g, '$1');
    sanitized = sanitized.replace(/text\{([^\}]+)\}/g, '$1');

    // 4. 중괄호 아래첨자 제거 (v_{실험} -> v_실험, f_n -> f_n)
    sanitized = sanitized.replace(/_\{([^\}]+)\}/g, '_$1');

    // 5. \left(, \right) -> (, ) 변환
    sanitized = sanitized.replace(/\\left\(/g, '(').replace(/\\right\)/g, ')');
    sanitized = sanitized.replace(/\\left\[/g, '[').replace(/\\right\]/g, ']');
    sanitized = sanitized.replace(/left\(/g, '(').replace(/right\(/g, ')');
    sanitized = sanitized.replace(/left\[/g, '[').replace(/right\]/g, ']');

    // 6. 그리스 문자 및 연산자 기호 영어 명칭을 유니코드로 변경 (lambda, root 등)
    sanitized = sanitized.replace(/\\lambda/g, 'λ').replace(/\blambda\b/g, 'λ').replace(/lambda/g, 'λ');
    sanitized = sanitized.replace(/\\sqrt/g, '√').replace(/root/g, '√');
    sanitized = sanitized.replace(/\\times/g, '×').replace(/times/g, '×');
    sanitized = sanitized.replace(/\\mp/g, '±').replace(/mp/g, '±');
    sanitized = sanitized.replace(/\\pm/g, '±').replace(/pm/g, '±');

    // 7. 달러 기호($) 제거
    sanitized = sanitized.replace(/\$([^\$]+)\$/g, '$1');

    // 8. 남은 백슬래시 (\) 제거
    sanitized = sanitized.replace(/\\/g, '');

    return sanitized;
}

// 마크다운을 HTML로 변환하는 함수
const defaultCoordinateGraph = `
<div class="graph-container" style="margin: 15px auto; max-width: 900px; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; background: #ffffff; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
<div class="graph-area">
<svg width="100%" height="auto" viewBox="0 0 800 360" xmlns="http://www.w3.org/2000/svg" style="display: block; margin: 0 auto;">
  <!-- Background Card -->
  <rect x="2" y="2" width="796" height="356" rx="12" ry="12" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5"/>
  
  <!-- Grid Lines (1.5x larger grids: 30x30) -->
  <defs>
    <pattern id="grid-pattern" width="30" height="30" patternUnits="userSpaceOnUse">
      <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#e2edf9" stroke-width="1.2"/>
    </pattern>
  </defs>
  <rect x="3" y="3" width="794" height="354" rx="11" ry="11" fill="url(#grid-pattern)"/>
  
  <!-- Main Axes (Thicker lines: 3px) -->
  <line x1="80" y1="20" x2="80" y2="340" stroke="#334155" stroke-width="3"/>
  <line x1="20" y1="280" x2="780" y2="280" stroke="#334155" stroke-width="3"/>
  
  <!-- Origin O (Larger font: 16px) -->
  <text x="55" y="305" font-family="'맑은 고딕', 'Malgun Gothic', Arial, sans-serif" font-size="16" font-weight="bold" fill="#475569" stroke="none">O</text>
  
  <!-- X-Axis Label (Larger font: 15px) -->
  <text x="400" y="335" font-family="'맑은 고딕', 'Malgun Gothic', Arial, sans-serif" font-size="15" font-weight="bold" fill="#1e293b" text-anchor="middle" stroke="none">x축 (조작변인)</text>
  
  <!-- Y-Axis Label (Larger font: 15px) -->
  <text x="100" y="45" font-family="'맑은 고딕', 'Malgun Gothic', Arial, sans-serif" font-size="15" font-weight="bold" fill="#1e293b" text-anchor="middle" stroke="none">y축 (종속변인)</text>
</svg>
<div style="text-align: center; margin-top: 10px; font-size: 11px; color: #64748b;">위 좌표평면에 실험 결과를 점으로 찍고 선으로 연결하여 그래프를 그려보세요.</div>
</div>
</div>
`;

export function markdownToHtml(markdown) {
    if (!markdown) return '';

    // LaTeX 기호 강제 정화
    let cleanMarkdown = sanitizeLatex(markdown);

    let xLabel = "x축 (조작변인)";
    let yLabel = "y축 (종속변인)";

    // 테이블에서 헤더(th)를 추출하여 동적 라벨 사용 시도
    try {
        const tableMatch = cleanMarkdown.match(/<table[^>]*>[\s\S]*?<\/table>/i);
        if (tableMatch) {
            const tableHtml = tableMatch[0];
            const thMatches = [...tableHtml.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)];
            if (thMatches && thMatches.length >= 2) {
                const cleanText = (str) => str.replace(/<[^>]*>/g, '').trim();
                const th1 = cleanText(thMatches[0][1]);
                const th2 = cleanText(thMatches[1][1]);

                if (th1 && th1 !== '회' && th1 !== '구분' && th1 !== '실험') {
                    if (thMatches.length >= 3) {
                        const th3 = cleanText(thMatches[2][1]);
                        xLabel = th2;
                        yLabel = th3;
                    } else {
                        xLabel = th1;
                        yLabel = th2;
                    }
                } else if (th2) {
                    xLabel = th2;
                    if (thMatches[2]) {
                        yLabel = cleanText(thMatches[2][1]);
                    }
                }
            }
        }
    } catch (e) {
        console.error("Failed to parse table headers for graph labels:", e);
    }

    // 동적 라벨 주입된 그래프 HTML 생성
    let graphHtml = defaultCoordinateGraph
        .replace("x축 (조작변인)", xLabel)
        .replace("y축 (종속변인)", yLabel);

    // 플레이스홀더를 실제 SVG 그래프 코드로 치환
    let content = cleanMarkdown.replace(/<div class="graph-placeholder"><\/div>/g, graphHtml);

    // HTML 태그가 이미 포함되어 있으면 그대로 반환
    if (content.includes('<') && content.includes('>')) {
        content = content.replace(/^## (.*$)/gim, '<h2>$1</h2>');
        content = content.replace(/^### (.*$)/gim, '<h3>$1</h3>');
        content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        content = content.replace(/\*(.*?)\*/g, '<em>$1</em>');
        content = content.replace(/^\* (.*$)/gim, '<li>$1</li>');

        // 연속된 <li> 태그들을 <ul>로 감싸기
        content = content.replace(/(<li>.*?<\/li>\s*)+/gs, (match) => {
            return '<ul>' + match + '</ul>';
        });

        // 문제의 핵심: 테이블과 관련된 줄바꿈만 엄격하게 제어
        content = content.replace(/\n+(<table[^>]*>)/g, '$1');
        content = content.replace(/(<\/table>)\n+/g, '$1');

        content = content.replace(/(<\/tr>)\n+(<tr>)/g, '$1$2');
        content = content.replace(/(<\/td>)\n+(<td>)/g, '$1$2');
        content = content.replace(/(<\/th>)\n+(<th>)/g, '$1$2');

        content = content.replace(/\n+(<div[^>]*>)/g, '$1');
        content = content.replace(/(<\/div>)\n+/g, '$1');

        content = content.replace(/\n(?![<\s])/g, '<br>');
        content = content.replace(/(<br>\s*){3,}/g, '<br><br>');

        content = content.replace(/<table/g, '<table style="margin: 10px auto; border-collapse: collapse; width: 90%;"');
        content = content.replace(/<div class="graph-container">/g, '<div class="graph-container" style="margin: 15px auto; max-width: 900px;">');

        return content;
    }

    if (typeof marked !== 'undefined') {
        return marked.parse(content);
    }

    return content
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^\* (.*$)/gim, '<li>$1</li>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/gim, '<br>');
}

// Word 파일용 HTML로 변환
function markdownToWordHtml(markdown) {
    if (!markdown) return '';

    // LaTeX 기호 강제 정화
    let cleanMarkdown = sanitizeLatex(markdown);

    let xLabel = "x축 (조작변인)";
    let yLabel = "y축 (종속변인)";

    // 테이블에서 헤더(th)를 추출하여 동적 라벨 사용 시도
    try {
        const tableMatch = cleanMarkdown.match(/<table[^>]*>[\s\S]*?<\/table>/i);
        if (tableMatch) {
            const tableHtml = tableMatch[0];
            const thMatches = [...tableHtml.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)];
            if (thMatches && thMatches.length >= 2) {
                const cleanText = (str) => str.replace(/<[^>]*>/g, '').trim();
                const th1 = cleanText(thMatches[0][1]);
                const th2 = cleanText(thMatches[1][1]);

                if (th1 && th1 !== '회' && th1 !== '구분' && th1 !== '실험') {
                    if (thMatches.length >= 3) {
                        const th3 = cleanText(thMatches[2][1]);
                        xLabel = th2;
                        yLabel = th3;
                    } else {
                        xLabel = th1;
                        yLabel = th2;
                    }
                } else if (th2) {
                    xLabel = th2;
                    if (thMatches[2]) {
                        yLabel = cleanText(thMatches[2][1]);
                    }
                }
            }
        }
    } catch (e) {
        console.error("Failed to parse table headers for graph labels in Word:", e);
    }

    // Word 호환 좌표평면 테이블 (가로축/세로축 경계선 강조 스타일 적용)
    const wordCompatibleGraph = `
    <div style="margin: 25px auto; text-align: center; max-width: 550px;">
        <h4 style="font-size: 11pt; font-weight: bold; color: #1e293b; margin-bottom: 8px;">(그래프 1) 실험 결과 그래프</h4>
        <table style="border-collapse: collapse; margin: 0 auto; width: 430px;">
            <!-- Y-axis Label Row -->
            <tr>
                <td style="width: 80px; text-align: right; padding-right: 8px; font-size: 9.5pt; font-weight: bold; color: #1e293b; border: none; vertical-align: bottom;">${yLabel}</td>
                <td colspan="10" style="border: none;"></td>
            </tr>
            <!-- Grid Rows 1-7 -->
            <tr style="height: 30px;">
                <td style="width: 80px; border: none; border-right: 3px solid #334155;"></td>
                <td style="border: 1px solid #e2edf9; width: 35px;"></td>
                <td style="border: 1px solid #e2edf9; width: 35px;"></td>
                <td style="border: 1px solid #e2edf9; width: 35px;"></td>
                <td style="border: 1px solid #e2edf9; width: 35px;"></td>
                <td style="border: 1px solid #e2edf9; width: 35px;"></td>
                <td style="border: 1px solid #e2edf9; width: 35px;"></td>
                <td style="border: 1px solid #e2edf9; width: 35px;"></td>
                <td style="border: 1px solid #e2edf9; width: 35px;"></td>
                <td style="border: 1px solid #e2edf9; width: 35px;"></td>
                <td style="border: 1px solid #e2edf9; width: 35px;"></td>
            </tr>
            <tr style="height: 30px;">
                <td style="width: 80px; border: none; border-right: 3px solid #334155;"></td>
                <td style="border: 1px solid #e2edf9;"></td>
                <td style="border: 1px solid #e2edf9;"></td>
                <td style="border: 1px solid #e2edf9;"></td>
                <td style="border: 1px solid #e2edf9;"></td>
                <td style="border: 1px solid #e2edf9;"></td>
                <td style="border: 1px solid #e2edf9;"></td>
                <td style="border: 1px solid #e2edf9;"></td>
                <td style="border: 1px solid #e2edf9;"></td>
                <td style="border: 1px solid #e2edf9;"></td>
                <td style="border: 1px solid #e2edf9;"></td>
            </tr>
            <tr style="height: 30px;">
                <td style="width: 80px; border: none; border-right: 3px solid #334155;"></td>
                <td style="border: 1px solid #e2edf9;"></td>
                <td style="border: 1px solid #e2edf9;"></td>
                <td style="border: 1px solid #e2edf9;"></td>
                <td style="border: 1px solid #e2edf9;"></td>
                <td style="border: 1px solid #e2edf9;"></td>
                <td style="border: 1px solid #e2edf9;"></td>
                <td style="border: 1px solid #e2edf9;"></td>
                <td style="border: 1px solid #e2edf9;"></td>
                <td style="border: 1px solid #e2edf9;"></td>
                <td style="border: 1px solid #e2edf9;"></td>
            </tr>
            <tr style="height: 30px;">
                <td style="width: 80px; border: none; border-right: 3px solid #334155;"></td>
                <td style="border: 1px solid #e2edf9;"></td>
                <td style="border: 1px solid #e2edf9;"></td>
                <td style="border: 1px solid #e2edf9;"></td>
                <td style="border: 1px solid #e2edf9;"></td>
                <td style="border: 1px solid #e2edf9;"></td>
                <td style="border: 1px solid #e2edf9;"></td>
                <td style="border: 1px solid #e2edf9;"></td>
                <td style="border: 1px solid #e2edf9;"></td>
                <td style="border: 1px solid #e2edf9;"></td>
                <td style="border: 1px solid #e2edf9;"></td>
            </tr>
            <tr style="height: 30px;">
                <td style="width: 80px; border: none; border-right: 3px solid #334155;"></td>
                <td style="border: 1px solid #e2edf9;"></td>
                <td style="border: 1px solid #e2edf9;"></td>
                <td style="border: 1px solid #e2edf9;"></td>
                <td style="border: 1px solid #e2edf9;"></td>
                <td style="border: 1px solid #e2edf9;"></td>
                <td style="border: 1px solid #e2edf9;"></td>
                <td style="border: 1px solid #e2edf9;"></td>
                <td style="border: 1px solid #e2edf9;"></td>
                <td style="border: 1px solid #e2edf9;"></td>
                <td style="border: 1px solid #e2edf9;"></td>
            </tr>
            <tr style="height: 30px;">
                <td style="width: 80px; border: none; border-right: 3px solid #334155;"></td>
                <td style="border: 1px solid #e2edf9;"></td>
                <td style="border: 1px solid #e2edf9;"></td>
                <td style="border: 1px solid #e2edf9;"></td>
                <td style="border: 1px solid #e2edf9;"></td>
                <td style="border: 1px solid #e2edf9;"></td>
                <td style="border: 1px solid #e2edf9;"></td>
                <td style="border: 1px solid #e2edf9;"></td>
                <td style="border: 1px solid #e2edf9;"></td>
                <td style="border: 1px solid #e2edf9;"></td>
                <td style="border: 1px solid #e2edf9;"></td>
            </tr>
            <tr style="height: 30px;">
                <td style="width: 80px; border: none; border-right: 3px solid #334155;"></td>
                <td style="border: 1px solid #e2edf9;"></td>
                <td style="border: 1px solid #e2edf9;"></td>
                <td style="border: 1px solid #e2edf9;"></td>
                <td style="border: 1px solid #e2edf9;"></td>
                <td style="border: 1px solid #e2edf9;"></td>
                <td style="border: 1px solid #e2edf9;"></td>
                <td style="border: 1px solid #e2edf9;"></td>
                <td style="border: 1px solid #e2edf9;"></td>
                <td style="border: 1px solid #e2edf9;"></td>
                <td style="border: 1px solid #e2edf9;"></td>
            </tr>
            <!-- Bottom Grid Row 8 (border-bottom is thick X-axis) -->
            <tr style="height: 30px;">
                <td style="width: 80px; border: none; border-right: 3px solid #334155;"></td>
                <td style="border: 1px solid #e2edf9; border-bottom: 3px solid #334155;"></td>
                <td style="border: 1px solid #e2edf9; border-bottom: 3px solid #334155;"></td>
                <td style="border: 1px solid #e2edf9; border-bottom: 3px solid #334155;"></td>
                <td style="border: 1px solid #e2edf9; border-bottom: 3px solid #334155;"></td>
                <td style="border: 1px solid #e2edf9; border-bottom: 3px solid #334155;"></td>
                <td style="border: 1px solid #e2edf9; border-bottom: 3px solid #334155;"></td>
                <td style="border: 1px solid #e2edf9; border-bottom: 3px solid #334155;"></td>
                <td style="border: 1px solid #e2edf9; border-bottom: 3px solid #334155;"></td>
                <td style="border: 1px solid #e2edf9; border-bottom: 3px solid #334155;"></td>
                <td style="border: 1px solid #e2edf9; border-bottom: 3px solid #334155;"></td>
            </tr>
            <!-- Labels Row below X-axis -->
            <tr>
                <td style="width: 80px; text-align: right; padding-right: 8px; padding-top: 5px; font-size: 10pt; font-weight: bold; color: #475569; border: none;">O</td>
                <td colspan="10" style="text-align: center; padding-top: 8px; font-size: 9.5pt; font-weight: bold; color: #1e293b; border: none;">${xLabel}</td>
            </tr>
        </table>
        <p style="font-size: 9.5pt; color: #64748b; margin-top: 10px; font-style: italic;">위 좌표평면에 실험 결과를 점으로 찍고 선으로 연결하여 그래프를 그려보세요.</p>
    </div>`

    let content = cleanMarkdown;

    // 플레이스홀더를 Word 호환 테이블로 대체
    content = content.replace(/<div class="graph-placeholder"><\/div>/g, wordCompatibleGraph);

    // Base64 SVG 이미지가 포함된 그래프 컨테이너를 Word 호환 테이블로 대체 (하위 호환)
    content = content.replace(/<div class="graph-container">[\s\S]*?<\/div>\s*<\/div>/g, wordCompatibleGraph);

    // HTML 태그가 이미 포함되어 있으면 그대로 사용
    if (content.includes('<') && content.includes('>')) {
        // 기본적인 마크다운 문법 처리
        content = content.replace(/^## (.*$)/gim, '<h2>$1</h2>');
        content = content.replace(/^### (.*$)/gim, '<h3>$1</h3>');
        content = content.replace(/^\*\*(.*?)\*\*/gm, '<strong>$1</strong>');
        content = content.replace(/^\* (.*$)/gim, '<li>$1</li>');

        // 연속된 <li> 태그들을 <ul>로 감싸기
        content = content.replace(/(<li>.*?<\/li>\s*)+/gs, (match) => {
            return '<ul>' + match + '</ul>';
        });

        // 줄바꿈 처리 (Word용으로 단순화)
        content = content.replace(/\n(?![<\s])/g, '<br>');

        return content;
    }

    // marked 라이브러리 사용
    if (typeof marked !== 'undefined') {
        return marked.parse(content);
    }

    // 간단한 마크다운 변환
    return content
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^- (.*$)/gim, '<li>$1</li>')
        .replace(/^\* (.*$)/gim, '<li>$1</li>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/_(.*?)_/g, '<em>$1</em>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>')
        .replace(/^/, '<p>')
        .replace(/$/, '</p>');
}

// HTML 파일로 다운로드하는 함수 (Word에서 열 수 있음)
export async function downloadAsDocx(content, filename) {
    try {
        // 마크다운을 HTML로 변환
        const htmlContent = markdownToWordHtml(content);

        // Word에서 열 수 있는 HTML 형식으로 생성
        const fullHtml = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="ProgId" content="Word.Document">
    <meta name="Generator" content="Microsoft Word 15">
    <title>${filename}</title>
    <style type="text/css">
        @page {
            size: A4;
            margin: 2cm 2cm 2cm 2cm;
        }
        body { 
            font-family: '맑은 고딕', 'Malgun Gothic', Arial, sans-serif; 
            font-size: 11pt; 
            line-height: 1.8; 
            color: #334155;
            margin: 0; 
        }
        h1 { 
            font-size: 20pt; 
            font-weight: bold; 
            color: #0f172a; 
            margin-top: 24pt; 
            margin-bottom: 12pt; 
            border-bottom: 2px solid #3b82f6; 
            padding-bottom: 6px; 
        }
        h2 { 
            font-size: 14pt; 
            font-weight: bold; 
            color: #1e293b; 
            margin-top: 20pt; 
            margin-bottom: 8pt; 
            border-bottom: 1px solid #e2e8f0; 
            padding-bottom: 4px; 
        }
        h3 { 
            font-size: 12pt; 
            font-weight: bold; 
            color: #475569; 
            margin-top: 14pt; 
            margin-bottom: 6pt; 
        }
        p { 
            margin-top: 8pt; 
            margin-bottom: 8pt; 
            color: #334155; 
        }
        ul { 
            margin-left: 20pt; 
            margin-bottom: 10pt; 
        }
        li { 
            margin-bottom: 4pt; 
        }
        strong { 
            font-weight: bold; 
            color: #0f172a; 
        }
        em { 
            font-style: italic; 
        }
        table { 
            border-collapse: collapse; 
            width: 100%; 
            margin: 15px 0; 
        }
        th, td { 
            border: 1px solid #cbd5e1; 
            padding: 4px 8px; 
            text-align: center; 
            font-size: 10.5pt;
            line-height: 1.2;
        }
        /* 일반 실험 결과 기록용 표의 행높이를 줄이고 컴팩트하게 설정 (인라인 스타일이 있는 그래프 모눈종이는 영향받지 않음) */
        table td {
            height: 24px;
        }
        table th {
            height: 24px;
        }
        th { 
            background-color: #f1f5f9; 
            font-weight: bold; 
            color: #0f172a; 
        }
        .graph-container {
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 15px;
            margin: 20px auto;
            background-color: #ffffff;
            max-width: 900px;
        }
    </style>
</head>
<body>
${htmlContent}
</body>
</html>`;

        // Blob 생성
        const blob = new Blob([fullHtml], {
            type: 'application/msword'
        });

        // 다운로드 실행 (.doc 확장자 사용)
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${filename}.doc`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        console.log('파일 다운로드 완료:', filename);

    } catch (error) {
        console.error('다운로드 오류:', error);
        throw new Error('파일 다운로드 중 오류가 발생했습니다: ' + error.message);
    }
}

// 파일 내용 읽기 관련 함수들
// PDF 읽기 함수
async function readPdfFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = async (e) => {
            try {
                const typedarray = new Uint8Array(e.target.result);
                const pdf = await pdfjsLib.getDocument(typedarray).promise;
                let text = '';

                for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                    const page = await pdf.getPage(pageNum);
                    const content = await page.getTextContent();
                    const pageText = content.items.map(item => item.str).join(' ');
                    text += pageText + '\n';
                }

                resolve(text);
            } catch (error) {
                reject(error);
            }
        };

        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(file);
    });
}

// DOCX 읽기 함수
async function readDocxFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = async (e) => {
            try {
                const arrayBuffer = e.target.result;
                const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
                resolve(result.value);
            } catch (error) {
                reject(error);
            }
        };

        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(file);
    });
}

// 일반 텍스트 파일 읽기 함수
async function readTextFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (event) => {
            resolve(event.target.result);
        };

        reader.onerror = (error) => {
            reject(error);
        };

        reader.readAsText(file);
    });
}

// 파일 내용 읽기 함수 (통합된 버전)
export async function readFileContent(file) {
    const fileType = file.name.split('.').pop().toLowerCase();

    try {
        switch (fileType) {
            case 'pdf':
                return await readPdfFile(file);

            case 'docx':
                return await readDocxFile(file);

            case 'txt':
            case 'md':
            default:
                return await readTextFile(file);
        }
    } catch (error) {
        console.error('파일 읽기 오류:', error);
        throw new Error(`${fileType.toUpperCase()} 파일 읽기 중 오류가 발생했습니다: ${error.message}`);
    }
}

// 디버그 함수
export function debug(message, data) {
    if (console && console.log) {
        console.log(`[DEBUG] ${message}`, data);
    }
}

// 에러 메시지 표시
export function showErrorMessage(message) {
    alert(message); // 간단한 구현, 나중에 모달로 대체 가능
}

// 타이핑 효과를 구현하는 가상 렌더러 클래스
export class TypingRenderer {
    constructor(containerId, onComplete) {
        this.containerId = containerId;
        this.queue = '';
        this.renderedText = '';
        this.intervalId = null;
        this.onComplete = onComplete;
        this.isFinished = false;
        this.speed = 10; // 글자 출력 주기 (ms)
    }
    
    get container() {
        return document.getElementById(this.containerId);
    }
    
    start() {
        if (this.intervalId) return;
        this.intervalId = setInterval(() => {
            if (this.queue.length > 0) {
                // 한 번에 1~3글자씩 잘라서 자연스럽게 채움
                const takeCount = Math.min(this.queue.length, 3);
                const chunk = this.queue.slice(0, takeCount);
                this.queue = this.queue.slice(takeCount);
                
                this.renderedText += chunk;
                const target = this.container;
                if (target) {
                    target.innerHTML = markdownToHtml(this.renderedText);
                }
            } else if (this.isFinished) {
                this.stop();
                if (this.onComplete) {
                    this.onComplete(this.renderedText);
                }
            }
        }, this.speed);
    }
    
    add(text) {
        this.queue += text;
        this.start();
    }
    
    finish() {
        this.isFinished = true;
    }
    
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }
}