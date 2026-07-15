// template.js - 학생용 템플릿 탭 모듈

import { callGeminiService, callGeminiServiceStream } from '../shared/api.js';
import { studentReportTemplatePrompt, templateRevisionPrompt } from './template-prompts.js';
import { renderTemplate, markdownToHtml, downloadAsDocx, TypingRenderer } from '../shared/utils.js';
import { dataStore } from '../shared/data-store.js';

// 탭 초기화 함수
export function init() {
    console.log('🔥 Template tab initialized');
    setupEventListeners();
    
    // 데이터 스토어 구독
    dataStore.subscribe('template-generated', handleTemplateGenerated);
    dataStore.subscribe('template-streaming', handleTemplateStreaming);
    dataStore.subscribe('template-stream-start', handleTemplateStreamStart);
    dataStore.subscribe('template-stream-error', handleTemplateStreamError);
    
    // 이미 템플릿이 스토어에 존재하면 즉시 표시
    const existingTemplate = dataStore.getTemplate();
    
    console.log('🔥 Template tab init - existing template:', !!existingTemplate);
    
    if (existingTemplate) {
        console.log('🔥 Found existing template, displaying it...');
        displayTemplate(existingTemplate);
    }
}

// 이벤트 리스너 설정
function setupEventListeners() {
    // 템플릿 수정 요청 버튼
    const templateRevisionBtn = document.getElementById('templateRevisionBtn');
    if (templateRevisionBtn) {
        templateRevisionBtn.addEventListener('click', handleTemplateRevisionClick);
    }
    
    // 내보내기 버튼
    const exportBtn = document.getElementById('exportTemplateBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => handleExport('template'));
    }
    
    // 모달 관련
    const submitRevisionBtn = document.getElementById('submitTemplateRevisionBtn');
    if (submitRevisionBtn) {
        submitRevisionBtn.addEventListener('click', handleSubmitTemplateRevision);
    }
    
    // 모달 닫기
    const closeBtn = document.querySelector('#templateRevisionModal .close-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeModal);
    }
}

// 템플릿 결과 표시
function displayTemplate(template) {
    const resultContainer = document.getElementById('templateResult');
    const actionsContainer = document.getElementById('templateActions');
    
    if (resultContainer) {
        resultContainer.innerHTML = markdownToHtml(template);
        actionsContainer.style.display = 'block';
    }
}

// 템플릿 생성 완료 처리
function handleTemplateGenerated(template) {
    displayTemplate(template);
}

// 백그라운드 템플릿 스트리밍 상태 핸들러
function handleTemplateStreaming(data) {
    const resultContainer = document.getElementById('templateResult');
    const actionsContainer = document.getElementById('templateActions');
    
    if (resultContainer) {
        resultContainer.innerHTML = markdownToHtml(data.text);
        if (actionsContainer) {
            actionsContainer.style.display = 'none'; // 실시간 작성 중에는 버튼들 숨김
        }
    }
}

// 템플릿 생성 시작 시 안내 메시지 개선 (에러 느낌 해소)
function handleTemplateStreamStart() {
    const resultContainer = document.getElementById('templateResult');
    const actionsContainer = document.getElementById('templateActions');
    
    if (resultContainer) {
        resultContainer.innerHTML = `
            <div class="placeholder-message template-generating-state" style="text-align: center; padding: 50px 20px; color: #4a6fa5; border: 1px dashed #bbdefb; border-radius: 8px; background-color: #f8fbff; margin: 20px auto; max-width: 600px;">
                <h3 class="pulse-text" style="margin: 0; color: #2b4c7e; font-size: 1.15rem; font-weight: 500;">
                    📝 학생용 보고서 템플릿이 생성되는 중입니다...
                </h3>
            </div>
        `;
        if (actionsContainer) {
            actionsContainer.style.display = 'none';
        }
    }
}

function handleTemplateStreamError(errorMsg) {
    showError('템플릿 생성 중 오류가 발생했습니다: ' + errorMsg);
}

// 템플릿 수정 요청 버튼 클릭
function handleTemplateRevisionClick() {
    const modal = document.getElementById('templateRevisionModal');
    if (modal) {
        modal.style.display = 'block';
    }
}

// 템플릿 수정 요청 제출
async function handleSubmitTemplateRevision() {
    const revisionRequest = document.getElementById('templateRevisionRequest')?.value;
    const currentTemplate = dataStore.getTemplate();
    const currentExperiment = dataStore.getExperiment();
    
    if (!revisionRequest.trim()) {
        alert('수정 요청 내용을 입력해주세요.');
        return;
    }
    
    if (!currentTemplate) {
        alert('수정할 템플릿이 없습니다.');
        return;
    }
    
    if (!currentExperiment) {
        alert('참조할 실험이 없습니다.');
        return;
    }
    
    try {
        closeModal();
        
        // 템플릿 수정 프롬프트 생성
        const prompt = renderTemplate(templateRevisionPrompt, {
            originalExperiment: currentExperiment,
            originalTemplate: currentTemplate,
            revisionRequest: revisionRequest
        });
        
        // AI 호출 (스트리밍)
        const messages = [{ role: 'user', content: prompt }];
        let isFirstChunk = true;
        
        const resultContainer = document.getElementById('templateResult');
        const actionsContainer = document.getElementById('templateActions');
        if (resultContainer) {
            resultContainer.innerHTML = `
                <div class="placeholder-message template-generating-state" style="text-align: center; padding: 50px 20px; color: #4a6fa5; border: 1px dashed #bbdefb; border-radius: 8px; background-color: #f8fbff; margin: 20px auto; max-width: 600px;">
                    <h3 class="pulse-text" style="margin: 0; color: #2b4c7e; font-size: 1.15rem; font-weight: 500;">
                        📝 학생용 보고서 템플릿을 수정하는 중입니다...
                    </h3>
                </div>
            `;
            actionsContainer.style.display = 'none';
        }
        
        // 템플릿 수정 요청에도 가상 타이핑 렌더러 탑재 (부드러운 출력 보장)
        const renderer = new TypingRenderer('templateResult', (finalText) => {
            if (finalText) {
                dataStore.setTemplate(finalText);
                if (actionsContainer) {
                    actionsContainer.style.display = 'block';
                }
                
                // 입력 필드 초기화
                const inputField = document.getElementById('templateRevisionRequest');
                if (inputField) inputField.value = '';
            }
        });
        
        await callGeminiServiceStream(messages, (chunk) => {
            if (isFirstChunk) {
                isFirstChunk = false;
            }
            renderer.add(chunk);
        });
        
        renderer.finish();
        
    } catch (error) {
        console.error('템플릿 수정 오류:', error);
        showError('템플릿 수정 중 오류가 발생했습니다: ' + error.message);
    }
}

// 내보내기 처리
async function handleExport(type) {
    const template = dataStore.getTemplate();
    
    if (!template) {
        alert('내보낼 템플릿이 없습니다.');
        return;
    }
    
    try {
        const filename = `학생용템플릿_${new Date().toLocaleDateString('ko-KR')}`;
        await downloadAsDocx(template, filename);
    } catch (error) {
        console.error('파일 다운로드 오류:', error);
        alert('파일 다운로드 중 오류가 발생했습니다.');
    }
}

// 모달 닫기
function closeModal() {
    const modal = document.getElementById('templateRevisionModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// 로딩 표시
function showLoading(message) {
    window.showLoading && window.showLoading(message);
}

// 로딩 숨기기
function hideLoading() {
    window.hideLoading && window.hideLoading();
}

// 에러 표시
function showError(message) {
    window.showErrorMessage && window.showErrorMessage(message);
}