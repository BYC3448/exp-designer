// experiment.js - 실험 설계안 탭 모듈

import { callGeminiService, callGeminiServiceStream } from '../shared/api.js';
import { experimentDesignPrompt, experimentRevisionPrompt } from './experiment-prompts.js';
import { renderTemplate, formatPrerequisiteContent, markdownToHtml, downloadAsDocx, TypingRenderer } from '../shared/utils.js';
import { getPrerequisiteContent } from '../shared/curriculum.js';
import { dataStore } from '../shared/data-store.js';

// 탭 초기화 함수
export function init() {
    console.log('Experiment tab initialized');
    setupEventListeners();
    
    // 데이터 스토어 구독
    dataStore.subscribe('experiment-generated', handleExperimentGenerated);
    dataStore.subscribe('form-submitted', handleFormSubmit);
}

// 이벤트 리스너 설정
function setupEventListeners() {
    // 수정 요청 버튼
    const revisionBtn = document.getElementById('revisionBtn');
    if (revisionBtn) {
        revisionBtn.addEventListener('click', handleRevisionClick);
    }
    
    // 내보내기 버튼
    const exportBtn = document.getElementById('exportExperimentBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => handleExport('experiment'));
    }
    
    // 모달 관련
    const submitRevisionBtn = document.getElementById('submitRevisionBtn');
    if (submitRevisionBtn) {
        submitRevisionBtn.addEventListener('click', handleSubmitRevision);
    }
    
    // 모달 닫기
    const closeBtn = document.querySelector('#revisionModal .close-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeModal);
    }
}

// 폼 제출 처리
async function handleFormSubmit(formData) {
    console.log('Experiment tab received form data:', formData);
    
    try {
        // 기존 풀스크린 로딩창 호출은 삭제했습니다.
        
        // 선수학습 내용 가져오기
        const prerequisites = getPrerequisiteContent(
            formData.schoolLevel, 
            formData.gradeGroup
        );
        
        // 프롬프트 생성
        const prompt = renderTemplate(experimentDesignPrompt, {
            schoolLevel: formData.schoolLevel,
            gradeGroup: formData.gradeGroup,
            subject: formData.subject,
            unit: formData.unit,
            contentElements: formData.selectedElements.join(', '),
            prerequisiteContent: formatPrerequisiteContent(prerequisites),
            experimentTopic: formData.experimentTopic,
            teacherIntent: formData.teacherIntent,
            referenceContent: formData.referenceContent || '참고 자료 없음'
        });
        
        // AI 호출 (스트리밍)
        const messages = [{ role: 'user', content: prompt }];
        let isFirstChunk = true;
        
        // 결과 표시 초기화
        const resultContainer = document.getElementById('experimentResult');
        const actionsContainer = document.getElementById('experimentActions');
        const outputSection = document.getElementById('outputSection');
        if (outputSection) {
            outputSection.style.display = 'block';
        }
        
        if (resultContainer) {
            resultContainer.innerHTML = `
                <div class="placeholder-message loading-state-box" style="text-align: center; padding: 50px 20px; color: #4a6fa5; border: 1px dashed #bbdefb; border-radius: 8px; background-color: #f8fbff; margin: 20px auto; max-width: 600px;">
                    <h3 class="pulse-text" style="margin: 0; color: #2b4c7e; font-size: 1.15rem; font-weight: 500;">
                        📝 실험 설계안이 생성되는 중입니다...
                    </h3>
                </div>
            `;
            actionsContainer.style.display = 'none';
            
            // 생성 로딩 상태로 즉각 부드러운 스크롤 이동
            resultContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        
        // 가상 타이핑 렌더러 장착 (앞부분 10줄 뭉쳐서 나오는 현상 완화)
        const renderer = new TypingRenderer('experimentResult', (finalText) => {
            if (finalText) {
                console.log('🔥 Experiment generated via stream, saving to store...');
                dataStore.setExperiment(finalText);
                if (actionsContainer) {
                    actionsContainer.style.display = 'block';
                }
                
                // 완료 시 탭 버튼이 위치한 최상단(outputSection)으로 부드럽게 스크롤 복원
                const outputEl = document.getElementById('outputSection');
                if (outputEl) {
                    outputEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
                
                // 템플릿도 바로 백그라운드 스트리밍으로 생성 (옵션 A)
                generateTemplateBackup(finalText);
            }
        });
        
        await callGeminiServiceStream(messages, (chunk) => {
            if (isFirstChunk) {
                if (resultContainer) resultContainer.innerHTML = ''; // 첫 글자가 오면 로딩 박스 삭제
                isFirstChunk = false;
            }
            renderer.add(chunk);
        });
        
        renderer.finish();
        
    } catch (error) {
        console.error('실험 설계 오류:', error);
        showError('실험 설계 중 오류가 발생했습니다: ' + error.message);
    }
}

// 백업용 템플릿 생성 함수
async function generateTemplateBackup(experiment) {
    try {
        console.log('🔥 Generating template backup via stream...');
        
        // 템플릿 상태 시작 알림
        dataStore.emit('template-stream-start');
        
        // 템플릿 프롬프트 임포트
        const { studentReportTemplatePrompt } = await import('../template/template-prompts.js');
        
        const templatePrompt = renderTemplate(studentReportTemplatePrompt, {
            experimentDesign: experiment
        });
        
        const messages = [{ role: 'user', content: templatePrompt }];
        let isFirst = true;
        
        // 백그라운드 스트리밍 청크 유입을 고르게 펴주는 데이터 펌프 (뚝뚝 끊김 방지)
        const mockRenderer = {
            queue: '',
            isFinished: false,
            intervalId: null,
            renderedText: '',
            start() {
                if (this.intervalId) return;
                this.intervalId = setInterval(() => {
                    if (this.queue.length > 0) {
                        const take = Math.min(this.queue.length, 3);
                        const sub = this.queue.slice(0, take);
                        this.queue = this.queue.slice(take);
                        
                        this.renderedText += sub;
                        if (isFirst) {
                            dataStore.updateTemplateStreaming(sub, true);
                            isFirst = false;
                        } else {
                            dataStore.updateTemplateStreaming(sub, false);
                        }
                    } else if (this.isFinished) {
                        clearInterval(this.intervalId);
                        this.intervalId = null;
                        if (this.renderedText) {
                            dataStore.setTemplate(this.renderedText);
                            console.log('🔥 Template backup stream completed successfully!');
                        }
                    }
                }, 10);
            },
            add(text) {
                this.queue += text;
                this.start();
            },
            finish() {
                this.isFinished = true;
            }
        };
        
        await callGeminiServiceStream(messages, (chunk) => {
            mockRenderer.add(chunk);
        });
        
        mockRenderer.finish();
        
    } catch (error) {
        console.error('❌ Template backup stream generation failed:', error);
        dataStore.emit('template-stream-error', error.message);
    }
}

// 실험 결과 표시
function displayExperiment(experiment) {
    const resultContainer = document.getElementById('experimentResult');
    const actionsContainer = document.getElementById('experimentActions');
    
    if (resultContainer) {
        resultContainer.innerHTML = markdownToHtml(experiment);
        actionsContainer.style.display = 'block';
        
        // 결과 영역으로 부드럽게 스크롤
        resultContainer.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
        });
    }
}

// 실험 생성 완료 처리
function handleExperimentGenerated(experiment) {
    displayExperiment(experiment);
}

// 수정 요청 버튼 클릭
function handleRevisionClick() {
    const modal = document.getElementById('revisionModal');
    if (modal) {
        modal.style.display = 'block';
    }
}

// 수정 요청 제출
async function handleSubmitRevision() {
    const revisionRequest = document.getElementById('revisionRequest')?.value;
    const currentExperiment = dataStore.getExperiment();
    
    if (!revisionRequest.trim()) {
        alert('수정 요청 내용을 입력해주세요.');
        return;
    }
    
    if (!currentExperiment) {
        alert('수정할 실험이 없습니다.');
        return;
    }
    
    try {
        closeModal();
        
        // 수정 프롬프트 생성
        const prompt = renderTemplate(experimentRevisionPrompt, {
            originalExperiment: currentExperiment,
            revisionRequest: revisionRequest
        });
        
        // AI 호출 (스트리밍)
        const messages = [{ role: 'user', content: prompt }];
        let isFirstChunk = true;
        
        const resultContainer = document.getElementById('experimentResult');
        if (resultContainer) {
            resultContainer.innerHTML = `
                <div class="placeholder-message loading-state-box" style="text-align: center; padding: 50px 20px; color: #4a6fa5; border: 1px dashed #bbdefb; border-radius: 8px; background-color: #f8fbff; margin: 20px auto; max-width: 600px;">
                    <h3 class="pulse-text" style="margin: 0; color: #2b4c7e; font-size: 1.15rem; font-weight: 500;">
                        📝 실험 설계안을 수정하는 중입니다...
                    </h3>
                </div>
            `;
            
            // 수정 로딩 상태로 즉각 부드러운 스크롤 이동
            resultContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        
        // 수정 요청에도 부드러운 가상 타이핑 렌더러 장착
        const renderer = new TypingRenderer('experimentResult', (finalText) => {
            if (finalText) {
                dataStore.setExperiment(finalText);
                
                // 완료 시 탭 버튼이 위치한 최상단(outputSection)으로 부드럽게 스크롤 복원
                const outputEl = document.getElementById('outputSection');
                if (outputEl) {
                    outputEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
                
                // 입력 필드 초기화
                const inputField = document.getElementById('revisionRequest');
                if (inputField) inputField.value = '';
                
                // 수정된 본안에 기초하여 템플릿 재생성 스트리밍 트리거
                generateTemplateBackup(finalText);
            }
        });
        
        await callGeminiServiceStream(messages, (chunk) => {
            if (isFirstChunk) {
                if (resultContainer) resultContainer.innerHTML = '';
                isFirstChunk = false;
            }
            renderer.add(chunk);
        });
        
        renderer.finish();
        
    } catch (error) {
        console.error('실험 수정 오류:', error);
        showError('실험 수정 중 오류가 발생했습니다: ' + error.message);
        hideLoading();
    }
}

// 내보내기 처리
async function handleExport(type) {
    const experiment = dataStore.getExperiment();
    
    if (!experiment) {
        alert('내보낼 실험이 없습니다.');
        return;
    }
    
    try {
        const filename = `실험설계안_${new Date().toLocaleDateString('ko-KR')}`;
        await downloadAsDocx(experiment, filename);
    } catch (error) {
        console.error('파일 다운로드 오류:', error);
        alert('파일 다운로드 중 오류가 발생했습니다.');
    }
}

// 모달 닫기
function closeModal() {
    const modal = document.getElementById('revisionModal');
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