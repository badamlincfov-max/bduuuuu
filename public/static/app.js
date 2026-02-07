// Tab switching
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;
        
        // Update tab buttons
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        document.getElementById(`${tabName}-tab`).classList.add('active');
        
        // Clear error message
        document.getElementById('error-message').style.display = 'none';
    });
});

// Avatar selection
document.querySelectorAll('.avatar-option').forEach(option => {
    option.addEventListener('click', () => {
        document.querySelectorAll('.avatar-option').forEach(opt => opt.classList.remove('selected'));
        option.classList.add('selected');
        document.getElementById('reg-avatar').value = option.dataset.avatar;
    });
});

// Show error message
function showError(message) {
    const errorDiv = document.getElementById('error-message');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 5000);
}

// Login form
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            window.location.href = '/chat.html';
        } else {
            showError(data.error || 'Giriş uğursuz oldu');
        }
    } catch (error) {
        showError('Xəta baş verdi: ' + error.message);
    }
});

// Admin login form
document.getElementById('admin-login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('admin-username').value;
    const password = document.getElementById('admin-password').value;
    
    try {
        const response = await fetch('/api/auth/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            window.location.href = '/admin.html';
        } else {
            showError(data.error || 'Admin girişi uğursuz oldu');
        }
    } catch (error) {
        showError('Xəta baş verdi: ' + error.message);
    }
});

// Registration - store form data and show verification
let registrationData = null;
let verificationQuestions = [];

document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const emailInput = document.getElementById('reg-email').value.trim();
    const fullEmail = emailInput + '@bsu.edu.az';
    const phoneInput = document.getElementById('reg-phone').value;
    const fullPhone = '+994' + phoneInput;
    
    registrationData = {
        email: fullEmail,
        phone: fullPhone,
        password: document.getElementById('reg-password').value,
        fullName: document.getElementById('reg-fullname').value,
        faculty: document.getElementById('reg-faculty').value,
        degree: document.getElementById('reg-degree').value,
        course: parseInt(document.getElementById('reg-course').value),
        avatar: document.getElementById('reg-avatar').value
    };
    
    try {
        // Load verification questions
        const response = await fetch('/api/auth/verification-questions');
        verificationQuestions = await response.json();
        
        // Display questions
        const container = document.getElementById('questions-container');
        container.innerHTML = '';
        
        verificationQuestions.forEach((q, index) => {
            const questionBlock = document.createElement('div');
            questionBlock.className = 'question-block';
            questionBlock.innerHTML = `
                <div class="question-text">${index + 1}. ${q.q}</div>
                <div class="radio-group">
                    <label class="radio-label">
                        <input type="radio" name="question-${index}" value="1" required>
                        <span>1</span>
                    </label>
                    <label class="radio-label">
                        <input type="radio" name="question-${index}" value="2" required>
                        <span>2</span>
                    </label>
                    <label class="radio-label">
                        <input type="radio" name="question-${index}" value="3" required>
                        <span>3</span>
                    </label>
                    <label class="radio-label">
                        <input type="radio" name="question-${index}" value="əsas" required>
                        <span>Əsas korpus</span>
                    </label>
                </div>
            `;
            container.appendChild(questionBlock);
        });
        
        // Switch to verification section
        document.getElementById('registration-form').classList.remove('active');
        document.getElementById('verification-section').classList.add('active');
        
    } catch (error) {
        showError('Xəta baş verdi: ' + error.message);
    }
});

// Back to form
document.getElementById('back-to-form').addEventListener('click', () => {
    document.getElementById('verification-section').classList.remove('active');
    document.getElementById('registration-form').classList.add('active');
});

// Submit verification and complete registration
document.getElementById('submit-verification').addEventListener('click', async () => {
    const answers = [];
    
    verificationQuestions.forEach((q, index) => {
        const selected = document.querySelector(`input[name="question-${index}"]:checked`);
        if (!selected) {
            showError('Bütün sualları cavablandırın');
            return;
        }
        answers.push({
            question: q.q,
            answer: selected.value
        });
    });
    
    if (answers.length !== 3) {
        showError('Bütün sualları cavablandırın');
        return;
    }
    
    try {
        // Verify answers
        const verifyResponse = await fetch('/api/auth/verify-answers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ answers })
        });
        
        const verifyData = await verifyResponse.json();
        
        if (!verifyData.passed) {
            showError(`Doğrulama uğursuz! ${verifyData.correctCount}/3 düzgün cavab. Minimum 2 düzgün cavab tələb olunur.`);
            return;
        }
        
        // Complete registration
        const registerResponse = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(registrationData)
        });
        
        const registerData = await registerResponse.json();
        
        if (registerResponse.ok) {
            alert('Qeydiyyat uğurla tamamlandı!');
            window.location.href = '/chat.html';
        } else {
            showError(registerData.error || 'Qeydiyyat uğursuz oldu');
            // Go back to form
            document.getElementById('verification-section').classList.remove('active');
            document.getElementById('registration-form').classList.add('active');
        }
    } catch (error) {
        showError('Xəta baş verdi: ' + error.message);
    }
});
