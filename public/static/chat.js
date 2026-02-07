// Socket.IO connection
const socket = io();

// Current user data
let currentUser = null;
let selectedUserId = null;
let currentChatType = 'group'; // 'group' or 'private'
let currentFaculty = null;

// Initialize
async function init() {
    try {
        // Check authentication
        const response = await fetch('/api/auth/check-session');
        const data = await response.json();
        
        if (!data.authenticated || data.userType !== 'user') {
            window.location.href = '/';
            return;
        }
        
        // Get user profile
        const profileResponse = await fetch('/api/user/profile');
        const profileData = await profileResponse.json();
        currentUser = profileData.user;
        currentFaculty = currentUser.faculty;
        
        // Update UI
        updateUserProfile();
        
        // Load settings
        loadSettings();
        
        // Connect to Socket.IO
        socket.emit('join', {
            userId: currentUser.id,
            faculty: currentUser.faculty
        });
        
        // Setup event listeners
        setupEventListeners();
        setupSocketListeners();
        
    } catch (error) {
        console.error('Initialization error:', error);
        window.location.href = '/';
    }
}

function updateUserProfile() {
    document.getElementById('user-name-sidebar').textContent = currentUser.full_name;
    document.getElementById('user-faculty-sidebar').textContent = currentUser.faculty;
    
    // Update avatar
    const avatarImg = document.querySelector('#user-avatar-sidebar img');
    if (currentUser.avatar === 'female') {
        avatarImg.style.objectPosition = 'left';
    } else {
        avatarImg.style.objectPosition = 'right';
    }
    
    // Update room button
    document.getElementById('my-faculty-btn').querySelector('.room-name').textContent = currentUser.faculty;
}

async function loadSettings() {
    try {
        const response = await fetch('/api/user/settings');
        const settings = await response.json();
        
        // Daily topic
        if (settings.daily_topic && settings.daily_topic.trim()) {
            document.getElementById('daily-topic-section').style.display = 'block';
            document.getElementById('daily-topic-content').textContent = settings.daily_topic;
        }
        
        // Store for modals
        window.rulesText = '';
        window.aboutText = settings.about_text || 'Bakı Dövlət Universiteti Tələbə Chat Platforması';
        
        // Try to get rules from admin settings (if accessible)
        try {
            const adminResponse = await fetch('/api/admin/settings');
            if (adminResponse.ok) {
                const adminSettings = await adminResponse.json();
                window.rulesText = adminSettings.filter_words || '';
            }
        } catch (e) {
            // Not admin, ignore
        }
    } catch (error) {
        console.error('Load settings error:', error);
    }
}

function setupEventListeners() {
    // Logout
    document.getElementById('logout-btn').addEventListener('click', async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
            window.location.href = '/';
        } catch (error) {
            console.error('Logout error:', error);
        }
    });
    
    // Send message
    document.getElementById('send-btn').addEventListener('click', sendMessage);
    document.getElementById('message-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
    
    // Edit profile
    document.getElementById('edit-profile-btn').addEventListener('click', openEditProfile);
    document.getElementById('save-profile-btn').addEventListener('click', saveProfile);
    
    // Avatar selection in edit modal
    document.querySelectorAll('#edit-profile-modal .avatar-option').forEach(option => {
        option.addEventListener('click', () => {
            document.querySelectorAll('#edit-profile-modal .avatar-option').forEach(opt => 
                opt.classList.remove('selected'));
            option.classList.add('selected');
            document.getElementById('edit-avatar').value = option.dataset.avatar;
        });
    });
    
    // Rules and About buttons
    document.getElementById('rules-btn').addEventListener('click', () => {
        document.getElementById('rules-content').textContent = window.rulesText || 'Qaydalar yüklənmədi';
        openModal('rules-modal');
    });
    
    document.getElementById('about-btn').addEventListener('click', () => {
        document.getElementById('about-content').textContent = window.aboutText;
        openModal('about-modal');
    });
    
    // Private chat
    document.getElementById('private-chat-btn').addEventListener('click', openPrivateChat);
    document.getElementById('private-send-btn').addEventListener('click', sendPrivateMessage);
    document.getElementById('private-message-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendPrivateMessage();
    });
    
    // Block user
    document.getElementById('block-user-btn').addEventListener('click', blockUser);
    document.getElementById('block-in-private-btn').addEventListener('click', () => {
        blockUser();
        closeModal('private-chat-modal');
    });
    
    // Report user
    document.getElementById('report-user-btn').addEventListener('click', reportUser);
    
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

function setupSocketListeners() {
    // Receive group messages
    socket.on('groupMessages', (messages) => {
        const container = document.getElementById('messages-container');
        container.innerHTML = '';
        messages.forEach(msg => displayGroupMessage(msg));
        scrollToBottom();
    });
    
    socket.on('newGroupMessage', (message) => {
        displayGroupMessage(message);
        scrollToBottom();
    });
    
    // Private messages
    socket.on('privateMessages', (messages) => {
        const container = document.getElementById('private-messages-container');
        container.innerHTML = '';
        messages.forEach(msg => displayPrivateMessage(msg));
        scrollToBottomPrivate();
    });
    
    socket.on('newPrivateMessage', (message) => {
        displayPrivateMessage(message);
        scrollToBottomPrivate();
    });
    
    // Block events
    socket.on('userBlocked', (data) => {
        if (data.success) {
            alert('İstifadəçi əngəlləndi');
            closeModal('user-actions-modal');
        }
    });
    
    socket.on('chatBlocked', () => {
        alert('Bu istifadəçi ilə söhbət mümkün deyil');
        closeModal('private-chat-modal');
    });
    
    socket.on('messageBlocked', () => {
        alert('Bu istifadəçi sizi əngəlləyib');
    });
    
    // Report events
    socket.on('userReported', (data) => {
        if (data.success) {
            alert('Şikayət göndərildi');
            closeModal('user-actions-modal');
        }
    });
}

function sendMessage() {
    const input = document.getElementById('message-input');
    const message = input.value.trim();
    
    if (!message) return;
    
    socket.emit('sendGroupMessage', {
        userId: currentUser.id,
        faculty: currentFaculty,
        message
    });
    
    input.value = '';
}

function displayGroupMessage(msg) {
    const container = document.getElementById('messages-container');
    const isOwn = msg.userId === currentUser.id;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isOwn ? 'own' : ''}`;
    messageDiv.dataset.userId = msg.userId;
    
    // Avatar
    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'message-avatar';
    const avatarImg = document.createElement('img');
    avatarImg.src = '/images/avatars.png';
    avatarImg.style.objectPosition = msg.avatar === 'female' ? 'left' : 'right';
    avatarDiv.appendChild(avatarImg);
    
    // Content
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    const headerDiv = document.createElement('div');
    headerDiv.className = 'message-header';
    
    const senderSpan = document.createElement('span');
    senderSpan.className = 'message-sender';
    senderSpan.textContent = msg.fullName;
    
    const infoSpan = document.createElement('span');
    infoSpan.className = 'message-info';
    infoSpan.textContent = `${msg.degree} - ${msg.course}-ci kurs`;
    
    headerDiv.appendChild(senderSpan);
    headerDiv.appendChild(infoSpan);
    
    // 3-dot menu (only for other users' messages)
    if (!isOwn) {
        const actionsSpan = document.createElement('span');
        actionsSpan.className = 'message-actions';
        actionsSpan.textContent = '⋮';
        actionsSpan.onclick = () => openUserActions(msg.userId);
        headerDiv.appendChild(actionsSpan);
    }
    
    const bubbleDiv = document.createElement('div');
    bubbleDiv.className = 'message-bubble';
    bubbleDiv.textContent = msg.message;
    
    const timeDiv = document.createElement('div');
    timeDiv.className = 'message-time';
    timeDiv.textContent = formatTime(msg.timestamp);
    
    contentDiv.appendChild(headerDiv);
    contentDiv.appendChild(bubbleDiv);
    contentDiv.appendChild(timeDiv);
    
    messageDiv.appendChild(avatarDiv);
    messageDiv.appendChild(contentDiv);
    
    container.appendChild(messageDiv);
}

function sendPrivateMessage() {
    const input = document.getElementById('private-message-input');
    const message = input.value.trim();
    
    if (!message || !selectedUserId) return;
    
    socket.emit('sendPrivateMessage', {
        senderId: currentUser.id,
        receiverId: selectedUserId,
        message
    });
    
    input.value = '';
}

function displayPrivateMessage(msg) {
    const container = document.getElementById('private-messages-container');
    const isOwn = msg.senderId === currentUser.id;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isOwn ? 'own' : ''}`;
    
    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'message-avatar';
    const avatarImg = document.createElement('img');
    avatarImg.src = '/images/avatars.png';
    avatarImg.style.objectPosition = msg.avatar === 'female' ? 'left' : 'right';
    avatarDiv.appendChild(avatarImg);
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    const headerDiv = document.createElement('div');
    headerDiv.className = 'message-header';
    
    const senderSpan = document.createElement('span');
    senderSpan.className = 'message-sender';
    senderSpan.textContent = msg.senderName;
    
    headerDiv.appendChild(senderSpan);
    
    const bubbleDiv = document.createElement('div');
    bubbleDiv.className = 'message-bubble';
    bubbleDiv.textContent = msg.message;
    
    const timeDiv = document.createElement('div');
    timeDiv.className = 'message-time';
    timeDiv.textContent = formatTime(msg.timestamp);
    
    contentDiv.appendChild(headerDiv);
    contentDiv.appendChild(bubbleDiv);
    contentDiv.appendChild(timeDiv);
    
    messageDiv.appendChild(avatarDiv);
    messageDiv.appendChild(contentDiv);
    
    container.appendChild(messageDiv);
}

function openUserActions(userId) {
    selectedUserId = userId;
    openModal('user-actions-modal');
}

async function openPrivateChat() {
    if (!selectedUserId) return;
    
    try {
        // Check if blocked
        const response = await fetch(`/api/user/is-blocked/${selectedUserId}`);
        const data = await response.json();
        
        if (data.blocked) {
            alert('Bu istifadəçi ilə söhbət mümkün deyil');
            return;
        }
        
        // Get user info
        const userResponse = await fetch(`/api/user/user/${selectedUserId}`);
        const userData = await userResponse.json();
        
        document.getElementById('private-chat-title').textContent = `Şəxsi Söhbət - ${userData.user.full_name}`;
        
        // Join private chat room
        socket.emit('joinPrivateChat', {
            userId: currentUser.id,
            otherUserId: selectedUserId
        });
        
        closeModal('user-actions-modal');
        openModal('private-chat-modal');
        
        // Clear previous messages
        document.getElementById('private-messages-container').innerHTML = '';
        
    } catch (error) {
        console.error('Open private chat error:', error);
        alert('Xəta baş verdi');
    }
}

function blockUser() {
    if (!selectedUserId) return;
    
    if (confirm('Bu istifadəçini əngəlləmək istədiyinizə əminsiniz?')) {
        socket.emit('blockUser', {
            blockerId: currentUser.id,
            blockedId: selectedUserId
        });
    }
}

function reportUser() {
    if (!selectedUserId) return;
    
    if (confirm('Bu istifadəçini şikayət etmək istədiyinizə əminsiniz?')) {
        socket.emit('reportUser', {
            reporterId: currentUser.id,
            reportedId: selectedUserId
        });
    }
}

function openEditProfile() {
    document.getElementById('edit-fullname').value = currentUser.full_name;
    document.getElementById('edit-faculty').value = currentUser.faculty;
    document.getElementById('edit-degree').value = currentUser.degree;
    document.getElementById('edit-course').value = currentUser.course;
    document.getElementById('edit-avatar').value = currentUser.avatar;
    
    // Select current avatar
    document.querySelectorAll('#edit-profile-modal .avatar-option').forEach(opt => {
        opt.classList.remove('selected');
        if (opt.dataset.avatar === currentUser.avatar) {
            opt.classList.add('selected');
        }
    });
    
    openModal('edit-profile-modal');
}

async function saveProfile() {
    const fullName = document.getElementById('edit-fullname').value.trim();
    const faculty = document.getElementById('edit-faculty').value;
    const degree = document.getElementById('edit-degree').value;
    const course = parseInt(document.getElementById('edit-course').value);
    const avatar = document.getElementById('edit-avatar').value;
    
    if (!fullName || !faculty || !degree || !course || !avatar) {
        alert('Bütün sahələri doldurun');
        return;
    }
    
    try {
        const response = await fetch('/api/user/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fullName, faculty, degree, course, avatar })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            currentUser = data.user;
            currentFaculty = data.user.faculty;
            updateUserProfile();
            closeModal('edit-profile-modal');
            alert('Profil yeniləndi');
            
            // Reconnect to new faculty room if changed
            socket.emit('join', {
                userId: currentUser.id,
                faculty: currentUser.faculty
            });
            
            // Clear messages and reload
            document.getElementById('messages-container').innerHTML = '';
        } else {
            alert(data.error || 'Xəta baş verdi');
        }
    } catch (error) {
        console.error('Save profile error:', error);
        alert('Xəta baş verdi');
    }
}

function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

function scrollToBottom() {
    const container = document.getElementById('messages-container');
    container.scrollTop = container.scrollHeight;
}

function scrollToBottomPrivate() {
    const container = document.getElementById('private-messages-container');
    container.scrollTop = container.scrollHeight;
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    
    // Check if today
    const isToday = date.getDate() === now.getDate() &&
                    date.getMonth() === now.getMonth() &&
                    date.getFullYear() === now.getFullYear();
    
    if (isToday) {
        return date.toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' });
    } else {
        return date.toLocaleDateString('az-AZ', { day: '2-digit', month: '2-digit' }) + ' ' +
               date.toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' });
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', init);
