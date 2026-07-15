// main.js - 메인 앱 컨트롤러

import { curriculumData } from './shared/curriculum.js';
import { dataStore } from './shared/data-store.js';
import { readFileContent, showErrorMessage, markdownToHtml } from './shared/utils.js';

// 현재 활성 탭
let currentTab = null;

// 앱 초기화
function init() {
    console.log('Main app initializing...');
    
    // DOM이 완전히 로드된 후 실행
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeApp);
    } else {
        initializeApp();
    }
}

// 앱 초기화
async function initializeApp() {
    console.log('Initializing main app...');
    
    // 기본 UI 설정
    setupDropdowns();
    setupFileUpload();
    setupEventListeners();
    
    // 첫 번째 탭 로드
    loadTab('experiment');
    
    // 백그라운드 모듈 선제 로드 (Preload) - 강력한 캐시 방지 쿼리 장착
    try {
        const templateModule = await import(`./template/template.js?v=${Date.now()}`);
        loadedModules['template'] = templateModule;
        if (templateModule && templateModule.init) {
            templateModule.init();
        }
        
        const videoModule = await import(`./video/video.js?v=${Date.now()}`);
        loadedModules['video'] = videoModule;
        if (videoModule && videoModule.init) {
            videoModule.init();
        }
    } catch (e) {
        console.warn('Failed to pre-import background modules:', e);
    }
    
    console.log('Main app initialized');
}

// 기본 이벤트 리스너 설정
function setupEventListeners() {
    // 폼 제출 이벤트
    const form = document.getElementById('experimentForm');
    if (form) {
        form.addEventListener('submit', handleFormSubmit);
    }
    
    // 탭 이벤트
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tabName = e.target.dataset.tab;
            loadTab(tabName);
        });
    });
    
    // 전역 모달 이벤트
    setupGlobalModalEvents();
    
    // 전역 함수 노출 (로딩, 에러 등)
    exposeGlobalFunctions();

    // 탭 위치 이동 탑 버튼 이벤트
    const scrollToTabsBtn = document.getElementById('scrollToTabsBtn');
    if (scrollToTabsBtn) {
        scrollToTabsBtn.addEventListener('click', () => {
            const outputEl = document.getElementById('outputSection');
            if (outputEl) {
                outputEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
        
        window.addEventListener('scroll', () => {
            // 스크롤이 세로로 300px 이상 내려갔을 때는 다른 조건 없이 탑 버튼을 무조건 노출합니다
            if (window.scrollY > 300) {
                scrollToTabsBtn.style.display = 'flex';
            } else {
                scrollToTabsBtn.style.display = 'none';
            }
        });
    }
}

// 전역 모달 이벤트 설정
function setupGlobalModalEvents() {
    // 모달 외부 클릭 시 닫기
    window.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
        }
    });
}

// 전역 함수 노출
function exposeGlobalFunctions() {
    // 로딩 관련
    window.showLoading = showLoading;
    window.hideLoading = hideLoading;
    window.showErrorMessage = showErrorMessage;
}

// 캐시된 모듈 인스턴스
const loadedModules = {};

// 탭 로드
async function loadTab(tabName) {
    try {
        console.log(`Switching to tab: ${tabName}`);
        
        // 탭 버튼 활성화
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.tab === tabName) {
                btn.classList.add('active');
            }
        });
        
        // 탭 HTML 영역 보임/숨김 처리
        document.querySelectorAll('.tab-view-content').forEach(view => {
            view.style.display = 'none';
        });
        
        const targetView = document.getElementById(`${tabName}-tab-view`);
        if (targetView) {
            targetView.style.display = 'block';
        }
        
        // 탭 JavaScript 모듈 로드 (최초 1회 캐시 활용)
        let module = loadedModules[tabName];
        if (!module) {
            try {
                module = await import(`./${tabName}/${tabName}.js?v=${Date.now()}`);
                loadedModules[tabName] = module;
                
                // 최초 1회만 모듈 초기화 실행
                if (module && module.init) {
                    module.init();
                }
            } catch (moduleError) {
                console.error(`Error loading ${tabName} module:`, moduleError);
            }
        }
        
        currentTab = { name: tabName, module };
        console.log(`Tab ${tabName} switch completed`);
        
        // 기존 데이터가 있으면 탭에 표시
        restoreTabData(tabName);
        
    } catch (error) {
        console.error(`Error switching tab ${tabName}:`, error);
        showErrorMessage(`탭 전환 중 오류가 발생했습니다: ${error.message}`);
    }
}

// 탭 데이터 복원 함수
function restoreTabData(tabName) {
    const experiment = dataStore.getExperiment();
    const template = dataStore.getTemplate();
    
    if (tabName === 'experiment' && experiment) {
        // 실험 탭에 기존 실험 데이터 표시
        const resultContainer = document.getElementById('experimentResult');
        const actionsContainer = document.getElementById('experimentActions');
        
        if (resultContainer && experiment) {
            resultContainer.innerHTML = markdownToHtml(experiment);
            if (actionsContainer) {
                actionsContainer.style.display = 'block';
            }
        }
    } else if (tabName === 'template' && template) {
        // 템플릿 탭에 기존 템플릿 데이터 표시
        const resultContainer = document.getElementById('templateResult');
        const actionsContainer = document.getElementById('templateActions');
        
        if (resultContainer && template) {
            // 스트리밍 초기 단계(글자 수가 짧을 때)에는 멍한 화면 대신 로딩 중 카드를 보여줌
            if (dataStore.isTemplateStreaming() && template.length < 200) {
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
            } else {
                resultContainer.innerHTML = markdownToHtml(template);
                if (actionsContainer) {
                    // 백그라운드 스트리밍이 여전히 작동 중인 상태라면 다운로드 버튼을 숨깁니다
                    if (dataStore.isTemplateStreaming()) {
                        actionsContainer.style.display = 'none';
                    } else {
                        actionsContainer.style.display = 'block';
                    }
                }
            }
        }
    }
}

// 드롭다운 설정
function setupDropdowns() {
    const schoolLevel = document.getElementById('schoolLevel');
    const gradeGroup = document.getElementById('gradeGroup');
    const subject = document.getElementById('subject');
    const unit = document.getElementById('unit');
    
    if (!schoolLevel) return;
    
    console.log('Setting up dropdowns...');
    
    // 학교급 초기화
    schoolLevel.innerHTML = '<option value="" disabled selected>학교급 선택</option>';
    Object.keys(curriculumData).forEach(school => {
        const option = document.createElement('option');
        option.value = school;
        option.textContent = school;
        schoolLevel.appendChild(option);
    });
    
    // 학교급 변경 이벤트
    schoolLevel.addEventListener('change', function() {
        console.log('School level changed to:', this.value);
        const selectedSchool = this.value;
        
        gradeGroup.innerHTML = '<option value="" disabled selected>학년군 선택</option>';
        subject.innerHTML = '<option value="" disabled selected>과목 선택</option>';
        unit.innerHTML = '<option value="" disabled selected>단원 선택</option>';
        
        if (selectedSchool && curriculumData[selectedSchool]) {
            Object.keys(curriculumData[selectedSchool]).forEach(grade => {
                const option = document.createElement('option');
                option.value = grade;
                option.textContent = grade;
                gradeGroup.appendChild(option);
            });
            gradeGroup.disabled = false;
        } else {
            gradeGroup.disabled = true;
        }
        subject.disabled = true;
        unit.disabled = true;
        clearContentElements();
        
        // 데이터 스토어 업데이트
        dataStore.setCurriculum({
            schoolLevel: selectedSchool,
            gradeGroup: null,
            subject: null,
            unit: null,
            selectedElements: []
        });
    });
    
    // 학년군 변경 이벤트
    gradeGroup.addEventListener('change', function() {
        const selectedSchool = schoolLevel.value;
        const selectedGrade = this.value;
        
        subject.innerHTML = '<option value="" disabled selected>과목 선택</option>';
        unit.innerHTML = '<option value="" disabled selected>단원 선택</option>';
        
        if (selectedSchool && selectedGrade && curriculumData[selectedSchool][selectedGrade]) {
            Object.keys(curriculumData[selectedSchool][selectedGrade]).forEach(subj => {
                const option = document.createElement('option');
                option.value = subj;
                option.textContent = subj;
                subject.appendChild(option);
            });
            subject.disabled = false;
        } else {
            subject.disabled = true;
        }
        unit.disabled = true;
        clearContentElements();
        
        // 데이터 스토어 업데이트
        dataStore.setCurriculum({
            schoolLevel: selectedSchool,
            gradeGroup: selectedGrade,
            subject: null,
            unit: null,
            selectedElements: []
        });
    });
    
    // 과목 변경 이벤트
    subject.addEventListener('change', function() {
        const selectedSchool = schoolLevel.value;
        const selectedGrade = gradeGroup.value;
        const selectedSubject = this.value;
        
        unit.innerHTML = '<option value="" disabled selected>단원 선택</option>';
        
        if (selectedSchool && selectedGrade && selectedSubject && 
            curriculumData[selectedSchool][selectedGrade][selectedSubject]) {
            Object.keys(curriculumData[selectedSchool][selectedGrade][selectedSubject]).forEach(u => {
                const option = document.createElement('option');
                option.value = u;
                option.textContent = u;
                unit.appendChild(option);
            });
            unit.disabled = false;
        } else {
            unit.disabled = true;
        }
        clearContentElements();
        
        // 데이터 스토어 업데이트
        dataStore.setCurriculum({
            schoolLevel: selectedSchool,
            gradeGroup: selectedGrade,
            subject: selectedSubject,
            unit: null,
            selectedElements: []
        });
    });
    
    // 단원 변경 이벤트
    unit.addEventListener('change', function() {
        const selectedSchool = schoolLevel.value;
        const selectedGrade = gradeGroup.value;
        const selectedSubject = subject.value;
        const selectedUnit = this.value;
        
        if (selectedSchool && selectedGrade && selectedSubject && selectedUnit) {
            const elements = curriculumData[selectedSchool][selectedGrade][selectedSubject][selectedUnit];
            if (elements) {
                displayContentElements(elements);
            }
        } else {
            clearContentElements();
        }
        
        // 데이터 스토어 업데이트 (단원까지 선택되면 동영상 자동 검색 트리거)
        const curriculumInfo = {
            schoolLevel: selectedSchool,
            gradeGroup: selectedGrade,
            subject: selectedSubject,
            unit: selectedUnit,
            selectedElements: []
        };
        
        console.log('📚 Full curriculum selected, updating dataStore:', curriculumInfo);
        dataStore.setCurriculum(curriculumInfo);
    });
}

// 내용 요소 표시
function displayContentElements(elements) {
    const container = document.getElementById('contentElements');
    if (!container) return;
    
    container.innerHTML = '';
    
    elements.forEach(element => {
        const span = document.createElement('span');
        span.className = 'content-element';
        span.textContent = element;
        span.addEventListener('click', () => toggleElementSelection(element, span));
        container.appendChild(span);
    });
    
    updateSelectedElementsDisplay();
}

// 요소 선택 토글
function toggleElementSelection(element, spanElement) {
    const currentData = dataStore.getCurriculum();
    let selectedElements = currentData.selectedElements || [];
    
    if (selectedElements.includes(element)) {
        selectedElements = selectedElements.filter(e => e !== element);
        spanElement.classList.remove('selected');
    } else {
        selectedElements.push(element);
        spanElement.classList.add('selected');
    }
    
    // 데이터 스토어 업데이트
    dataStore.setCurriculum({
        ...currentData,
        selectedElements
    });
    
    updateSelectedElementsDisplay();
}

// 선택된 요소 표시 업데이트
function updateSelectedElementsDisplay() {
    const selectedElements = dataStore.getCurriculum().selectedElements || [];
    const container = document.getElementById('selectedElements');
    const display = document.getElementById('selectedElementsDisplay');
    
    if (!container || !display) return;
    
    if (selectedElements.length > 0) {
        container.style.display = 'block';
        display.innerHTML = '';
        
        selectedElements.forEach(element => {
            const tag = document.createElement('span');
            tag.className = 'selected-element-tag';
            tag.innerHTML = `${element} <span class="remove-btn" onclick="removeSelectedElement('${element}')">&times;</span>`;
            display.appendChild(tag);
        });
    } else {
        container.style.display = 'none';
    }
}

// 선택된 요소 제거 (전역 함수)
window.removeSelectedElement = function(element) {
    const currentData = dataStore.getCurriculum();
    const selectedElements = (currentData.selectedElements || []).filter(e => e !== element);
    
    dataStore.setCurriculum({
        ...currentData,
        selectedElements
    });
    
    // UI 업데이트
    const elementSpan = Array.from(document.querySelectorAll('.content-element'))
        .find(span => span.textContent === element);
    if (elementSpan) {
        elementSpan.classList.remove('selected');
    }
    
    updateSelectedElementsDisplay();
};

// 내용 요소 초기화
function clearContentElements() {
    const container = document.getElementById('contentElements');
    if (container) {
        container.innerHTML = '<p class="placeholder-text">단원을 선택하면 내용 요소가 표시됩니다.</p>';
    }
    
    const selectedContainer = document.getElementById('selectedElements');
    if (selectedContainer) {
        selectedContainer.style.display = 'none';
    }
    
    // 데이터 스토어 초기화
    const currentData = dataStore.getCurriculum();
    dataStore.setCurriculum({
        ...currentData,
        selectedElements: []
    });
}

// 파일 업로드 설정
function setupFileUpload() {
    const fileInput = document.getElementById('referenceFile');
    if (!fileInput) return;
    
    fileInput.addEventListener('change', handleFileUpload);
}

// 파일 업로드 처리
async function handleFileUpload(event) {
    const file = event.target.files[0];
    const uploadArea = event.target.closest('.file-upload-area');
    const fileIcon = uploadArea.querySelector('.upload-icon');
    const fileLabel = uploadArea.querySelector('.file-drop-label');
    
    if (!file) {
        // 파일이 선택되지 않으면 원래 상태로
        fileIcon.textContent = '📁';
        fileLabel.textContent = '클릭하거나 파일을 드래그하여 업로드';
        uploadArea.classList.remove('file-selected', 'file-error');
        return;
    }
    
    try {
        // 업로드 중 표시
        fileIcon.textContent = '⏳';
        fileLabel.innerHTML = `<strong>${file.name}</strong><br>파일을 읽는 중입니다...`;
        uploadArea.classList.add('file-loading');
        uploadArea.classList.remove('file-selected', 'file-error');
        
        showLoading('파일을 읽는 중입니다...');
        const content = await readFileContent(file);
        
        // 데이터 스토어에 저장
        const currentFormData = dataStore.getFormData();
        dataStore.setFormData({
            ...currentFormData,
            referenceContent: content
        });
        
        // 성공 표시
        fileIcon.textContent = '✅';
        fileLabel.innerHTML = `<strong>${file.name}</strong><br>파일 업로드 완료 (${content.length}자)`;
        uploadArea.classList.remove('file-loading');
        uploadArea.classList.add('file-selected');
        
        console.log('파일 읽기 완료:', file.name);
        hideLoading();
        
    } catch (error) {
        console.error('파일 읽기 오류:', error);
        
        // 오류 표시
        fileIcon.textContent = '❌';
        fileLabel.innerHTML = `<strong>${file.name}</strong><br>파일 읽기 실패: ${error.message}`;
        uploadArea.classList.remove('file-loading');
        uploadArea.classList.add('file-error');
        
        showErrorMessage('파일 읽기 중 오류가 발생했습니다: ' + error.message);
        hideLoading();
    }
}

// 폼 제출 처리
async function handleFormSubmit(e) {
    e.preventDefault();
    
    // 폼 데이터 수집
    const formData = {
        schoolLevel: document.getElementById('schoolLevel')?.value,
        gradeGroup: document.getElementById('gradeGroup')?.value,
        subject: document.getElementById('subject')?.value,
        unit: document.getElementById('unit')?.value,
        selectedElements: dataStore.getCurriculum().selectedElements || [],
        experimentTopic: document.getElementById('experimentTopic')?.value || '',
        teacherIntent: document.getElementById('teacherIntent')?.value || '',
        referenceContent: dataStore.getFormData().referenceContent || ''
    };
    
    // 필수 필드 검증 (교육과정 정보만)
    if (!formData.schoolLevel || !formData.gradeGroup || !formData.subject || !formData.unit) {
        showErrorMessage('교육과정 정보를 모두 선택해주세요.');
        return;
    }
    
    if (formData.selectedElements.length === 0) {
        showErrorMessage('내용 요소를 하나 이상 선택해주세요.');
        return;
    }
    
    // 실험 주제와 수업 의도가 비어있으면 기본값 설정
    if (!formData.experimentTopic.trim()) {
        formData.experimentTopic = formData.selectedElements.join(', ') + ' 관련 실험';
    }
    
    if (!formData.teacherIntent.trim()) {
        formData.teacherIntent = formData.selectedElements.join(', ') + '에 대한 이해를 높이기 위한 실험';
    }
    
    console.log('Form submitted with data:', formData);
    
    // 결과 섹션 표시
    const outputSection = document.getElementById('outputSection');
    if (outputSection) {
        outputSection.style.display = 'block';
    }
    
    // 데이터 스토어를 통해 폼 제출 이벤트 발생
    dataStore.submitForm(formData);
}

// 로딩 표시
function showLoading(message = '처리 중입니다...') {
    const overlay = document.getElementById('loadingOverlay');
    const messageEl = document.getElementById('loadingMessage');
    
    if (overlay) {
        overlay.style.display = 'flex';
    }
    
    if (messageEl) {
        messageEl.textContent = message;
    }
}

// 로딩 숨기기
function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

// 앱 초기화 실행
init(); 