// Admin session data
let adminData = null;
let isSuperAdmin = false;

// Initialize
async function init() {
    try {
        // Check authentication
        const response = await fetch('/api/auth/check-session');
        const data = await response.json();
        
        if (!data.authenticated || data.userType !== 'admin') {
            window.location.href = '/';
            return;
        }
        
        adminData = data;
        isSuperAdmin = data.isSuperAdmin;
        
        // Show sub-admins card only for super admin
        if (isSuperAdmin) {
            document.getElementById('sub-admins-card').style.display = 'block';
        }
        
        // Load initial data
        await loadAllUsers();
        await loadSettings();
        
        // Setup event listeners
        setupEventListeners();
        
    } catch (error) {
        console.error('Initialization error:', error);
        window.location.href = '/';
    }
}

function setupEventListeners() {
    // Logout
    document.getElementById('admin-logout-btn').addEventListener('click', async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
            window.location.href = '/';
        } catch (error) {
            console.error('Logout error:', error);
        }
    });
    
    // Card clicks
    document.querySelector('.danger-card').addEventListener('click', () => {
        loadReportedUsers();
        openModal('reported-users-modal');
    });
    
    document.getElementById('filter-card').addEventListener('click', () => {
        openModal('filter-modal');
    });
    
    document.getElementById('users-card').addEventListener('click', () => {
        openModal('rules-modal');
    });
    
    document.getElementById('daily-topic-card').addEventListener('click', () => {
        openModal('daily-topic-modal');
    });
    
    document.getElementById('all-users-card').addEventListener('click', () => {
        loadAllUsers();
        openModal('all-users-modal');
    });
    
    if (isSuperAdmin) {
        document.getElementById('sub-admins-card').addEventListener('click', () => {
            loadSubAdmins();
            openModal('sub-admins-modal');
        });
    }
    
    // Save buttons
    document.getElementById('save-filter-btn').addEventListener('click', saveFilterWords);
    document.getElementById('save-rules-btn').addEventListener('click', saveRules);
    document.getElementById('save-daily-topic-btn').addEventListener('click', saveDailyTopic);
    document.getElementById('save-about-btn').addEventListener('click', saveAbout);
    
    if (isSuperAdmin) {
        document.getElementById('create-sub-admin-btn').addEventListener('click', createSubAdmin);
    }
    
    // Close modal buttons
    document.querySelectorAll('.close-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            closeModal(btn.dataset.modal);
        });
    });
    
    // Close modal on background click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal(modal.id);
            }
        });
    });
}

async function loadSettings() {
    try {
        const response = await fetch('/api/admin/settings');
        const settings = await response.json();
        
        // Load into textareas
        document.getElementById('filter-words-textarea').value = settings.filter_words || '';
        document.getElementById('daily-topic-textarea').value = settings.daily_topic || '';
        document.getElementById('about-textarea').value = settings.about_text || '';
        
    } catch (error) {
        console.error('Load settings error:', error);
    }
}

async function loadAllUsers() {
    try {
        const response = await fetch('/api/admin/users');
        const data = await response.json();
        
        // Update count
        document.getElementById('total-users-count').textContent = `İstifadəçi sayı: ${data.totalUsers}`;
        document.getElementById('users-count').textContent = data.totalUsers;
        
        // Display users
        const container = document.getElementById('all-users-list');
        container.innerHTML = '';
        
        if (data.users.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #999;">İstifadəçi tapılmadı</p>';
            return;
        }
        
        data.users.forEach(user => {
            const userDiv = createUserRow(user);
            container.appendChild(userDiv);
        });
        
    } catch (error) {
        console.error('Load all users error:', error);
        alert('İstifadəçilər yüklənərkən xəta baş verdi');
    }
}

async function loadReportedUsers() {
    try {
        const response = await fetch('/api/admin/reported-users');
        const data = await response.json();
        
        const container = document.getElementById('reported-users-list');
        container.innerHTML = '';
        
        if (data.users.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #999;">8+ şikayət alan istifadəçi yoxdur</p>';
            return;
        }
        
        data.users.forEach(user => {
            const userDiv = createUserRow(user, true);
            container.appendChild(userDiv);
        });
        
    } catch (error) {
        console.error('Load reported users error:', error);
        alert('Şikayət edilən istifadəçilər yüklənərkən xəta baş verdi');
    }
}

function createUserRow(user, showReports = false) {
    const div = document.createElement('div');
    div.className = 'user-row';
    
    const infoDiv = document.createElement('div');
    infoDiv.className = 'user-info';
    
    const rowDiv = document.createElement('div');
    rowDiv.className = 'user-info-row';
    
    rowDiv.innerHTML = `
        <div class="info-item"><strong>Ad:</strong> ${user.full_name}</div>
        <div class="info-item"><strong>Email:</strong> ${user.email}</div>
        <div class="info-item"><strong>Telefon:</strong> ${user.phone}</div>
        <div class="info-item"><strong>Fakültə:</strong> ${user.faculty}</div>
        <div class="info-item"><strong>Dərəcə:</strong> ${user.degree}</div>
        <div class="info-item"><strong>Kurs:</strong> ${user.course}</div>
    `;
    
    infoDiv.appendChild(rowDiv);
    
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'user-actions';
    
    // Report badge
    if (showReports && user.report_count > 0) {
        const badge = document.createElement('span');
        badge.className = `report-badge ${user.report_count >= 8 ? 'danger' : ''}`;
        badge.textContent = `${user.report_count} şikayət`;
        actionsDiv.appendChild(badge);
    }
    
    // Toggle button
    const toggleBtn = document.createElement('button');
    toggleBtn.className = `btn-toggle ${user.is_active ? 'active' : 'inactive'}`;
    toggleBtn.textContent = user.is_active ? 'Aktiv' : 'Deaktiv';
    toggleBtn.onclick = () => toggleUserStatus(user.id, toggleBtn);
    actionsDiv.appendChild(toggleBtn);
    
    div.appendChild(infoDiv);
    div.appendChild(actionsDiv);
    
    return div;
}

async function toggleUserStatus(userId, button) {
    try {
        const response = await fetch(`/api/admin/users/${userId}/toggle-status`, {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Update button
            button.className = `btn-toggle ${data.isActive ? 'active' : 'inactive'}`;
            button.textContent = data.isActive ? 'Aktiv' : 'Deaktiv';
            
            // Reload user count
            loadAllUsers();
        } else {
            alert(data.error || 'Xəta baş verdi');
        }
    } catch (error) {
        console.error('Toggle user status error:', error);
        alert('Xəta baş verdi');
    }
}

async function saveFilterWords() {
    const words = document.getElementById('filter-words-textarea').value.trim();
    
    try {
        const response = await fetch('/api/admin/settings/filter_words', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ value: words })
        });
        
        if (response.ok) {
            alert('Filtr sözləri yadda saxlanıldı');
            closeModal('filter-modal');
        } else {
            const data = await response.json();
            alert(data.error || 'Xəta baş verdi');
        }
    } catch (error) {
        console.error('Save filter words error:', error);
        alert('Xəta baş verdi');
    }
}

async function saveRules() {
    const rules = document.getElementById('rules-textarea').value.trim();
    
    try {
        const response = await fetch('/api/admin/settings/rules_text', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ value: rules })
        });
        
        if (response.ok) {
            alert('Qaydalar yadda saxlanıldı');
            closeModal('rules-modal');
        } else {
            const data = await response.json();
            alert(data.error || 'Xəta baş verdi');
        }
    } catch (error) {
        console.error('Save rules error:', error);
        alert('Xəta baş verdi');
    }
}

async function saveDailyTopic() {
    const topic = document.getElementById('daily-topic-textarea').value.trim();
    
    try {
        const response = await fetch('/api/admin/settings/daily_topic', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ value: topic })
        });
        
        if (response.ok) {
            alert('Günün mövzusu yadda saxlanıldı');
            closeModal('daily-topic-modal');
        } else {
            const data = await response.json();
            alert(data.error || 'Xəta baş verdi');
        }
    } catch (error) {
        console.error('Save daily topic error:', error);
        alert('Xəta baş verdi');
    }
}

async function saveAbout() {
    const about = document.getElementById('about-textarea').value.trim();
    
    try {
        const response = await fetch('/api/admin/settings/about_text', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ value: about })
        });
        
        if (response.ok) {
            alert('Haqqında mətni yadda saxlanıldı');
            closeModal('about-modal');
        } else {
            const data = await response.json();
            alert(data.error || 'Xəta baş verdi');
        }
    } catch (error) {
        console.error('Save about error:', error);
        alert('Xəta baş verdi');
    }
}

async function loadSubAdmins() {
    try {
        const response = await fetch('/api/admin/sub-admins');
        const data = await response.json();
        
        const container = document.getElementById('sub-admins-list');
        container.innerHTML = '';
        
        if (data.admins.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #999;">Alt admin yoxdur</p>';
            return;
        }
        
        data.admins.forEach(admin => {
            const adminDiv = document.createElement('div');
            adminDiv.className = 'sub-admin-item';
            
            const infoDiv = document.createElement('div');
            infoDiv.className = 'sub-admin-info';
            
            const nameDiv = document.createElement('div');
            nameDiv.className = 'sub-admin-name';
            nameDiv.textContent = admin.username;
            
            const dateDiv = document.createElement('div');
            dateDiv.className = 'sub-admin-date';
            dateDiv.textContent = `Yaradılıb: ${new Date(admin.created_at).toLocaleDateString('az-AZ')}`;
            
            infoDiv.appendChild(nameDiv);
            infoDiv.appendChild(dateDiv);
            
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'btn-delete';
            deleteBtn.textContent = 'Sil';
            deleteBtn.onclick = () => deleteSubAdmin(admin.id);
            
            adminDiv.appendChild(infoDiv);
            adminDiv.appendChild(deleteBtn);
            
            container.appendChild(adminDiv);
        });
        
    } catch (error) {
        console.error('Load sub-admins error:', error);
        alert('Alt adminlər yüklənərkən xəta baş verdi');
    }
}

async function createSubAdmin() {
    const username = document.getElementById('new-admin-username').value.trim();
    const password = document.getElementById('new-admin-password').value.trim();
    
    if (!username || !password) {
        alert('İstifadəçi adı və şifrə tələb olunur');
        return;
    }
    
    try {
        const response = await fetch('/api/admin/sub-admins', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            alert('Alt admin yaradıldı');
            document.getElementById('new-admin-username').value = '';
            document.getElementById('new-admin-password').value = '';
            loadSubAdmins();
        } else {
            alert(data.error || 'Xəta baş verdi');
        }
    } catch (error) {
        console.error('Create sub-admin error:', error);
        alert('Xəta baş verdi');
    }
}

async function deleteSubAdmin(adminId) {
    if (!confirm('Bu alt admini silmək istədiyinizə əminsiniz?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/admin/sub-admins/${adminId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            alert('Alt admin silindi');
            loadSubAdmins();
        } else {
            const data = await response.json();
            alert(data.error || 'Xəta baş verdi');
        }
    } catch (error) {
        console.error('Delete sub-admin error:', error);
        alert('Xəta baş verdi');
    }
}

function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', init);
