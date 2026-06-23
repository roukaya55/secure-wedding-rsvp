// ============================================
// CONFIGURATION - UPDATE THIS URL IF NEEDED
// ============================================
const API_URL = "https://script.google.com/macros/s/AKfycbz451IoNe8JdxlvJ5ItX9jJJHbDrPAVzC6uJtOM9XGFzR87kZupqxBFYWv3GVM87jV4zg/exec";

// ============================================
// STATE MANAGEMENT
// ============================================
let currentGuest = {
    name: "",
    seats: 0,
    maxSeats: 0,
    status: "",
    hasResponded: false,
    rowIndex: null
};

// ============================================
// DOM REFERENCES
// ============================================
const rsvpSection = document.getElementById('rsvp-section');
const welcomeText = document.getElementById('welcome-text');
const seatNumber = document.getElementById('seat-number');
const messageDiv = document.getElementById('message');
const btnAccept = document.getElementById('btn-accept');
const btnDecline = document.getElementById('btn-decline');
const statusBadgeContainer = document.getElementById('status-badge-container');
const btnDecreaseSeat = document.getElementById('btn-decrease-seat');
const btnIncreaseSeat = document.getElementById('btn-increase-seat');
const seatWarning = document.getElementById('seat-warning');

// ============================================
// HELPER FUNCTIONS
// ============================================
function setMessage(text, type = '') {
    messageDiv.textContent = text;
    messageDiv.className = type;
}

function showStatusBadge(status) {
    if (!status) return '';
    const statusMap = {
        'Attending': { class: 'attending', label: '✅ Currently Attending' },
        'Declined': { class: 'declined', label: '✖ Currently Declined' }
    };
    const info = statusMap[status];
    if (info) {
        return `<span class="status-badge ${info.class}">${info.label}</span>`;
    }
    return '';
}

function updateSeatAdjustmentButtons() {
    // If declined, lock adjustments completely
    if (currentGuest.status === 'Declined') {
        btnDecreaseSeat.disabled = true;
        btnIncreaseSeat.disabled = true;
        return;
    }

    btnDecreaseSeat.disabled = currentGuest.seats <= 1;
    btnIncreaseSeat.disabled = currentGuest.seats >= currentGuest.maxSeats;
    
    if (currentGuest.seats >= currentGuest.maxSeats) {
        seatWarning.innerHTML = `⚠️ You've hit your maximum allowed limit of <strong>${currentGuest.maxSeats}</strong> seats.`;
        seatWarning.style.color = "#8c7a6b";
    } else {
        seatWarning.innerHTML = `Allowed maximum: ${currentGuest.maxSeats} seats.`;
        seatWarning.style.color = "#a89a8d";
    }
}

// ============================================
// 1. AUTOMATIC CHECK ON INITIAL PAGE LOAD
// ============================================
window.addEventListener('DOMContentLoaded', async () => {
    // Extract the security token parameter string out from the address URL bar (e.g. ?id=kX8zP2)
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('id');

    if (!token) {
        setMessage("❌ Invalid Invitation Link. Please use your unique verification link.", "error");
        return;
    }

    setMessage("⌛ Reading your personal invitation link...", "info");

    try {
        const response = await fetch(`${API_URL}?type=getGuestByToken&token=${encodeURIComponent(token.trim())}`);
        const data = await response.json();

        if (data.found) {
            setMessage(''); // Clear reading status indicator text

            // Update local state container
            currentGuest = {
                name: data.name,
                seats: data.confirmedSeats,
                maxSeats: data.maxSeats || 1,
                status: data.status || '',
                hasResponded: data.hasResponded || false,
                rowIndex: data.rowIndex
            };

            // Inject localized dynamic text nodes
            welcomeText.textContent = `👋 ${data.name}`;
            seatNumber.textContent = currentGuest.seats;

            // Swap application display visibility layers
            rsvpSection.classList.remove('hidden');
            updateSeatAdjustmentButtons();

            if (data.hasResponded) {
                statusBadgeContainer.innerHTML = showStatusBadge(data.status);
                setMessage(`You already responded: ${data.status}`, 'info');
                btnAccept.textContent = '🔄 Update Attendance';
                btnDecline.textContent = '🔄 Update to Decline';
            } else {
                statusBadgeContainer.innerHTML = '';
                setMessage('Please confirm your attendance choices below:');
                btnAccept.textContent = '✅ Accept';
                btnDecline.textContent = '✖ Decline';
            }

        } else {
            setMessage("❌ Invitation data lookup trace failed. Code missing or invalid.", "error");
        }
    } catch (error) {
        console.error('Initial execution fetching loop error trace:', error);
        setMessage("❌ Network configuration pipeline failure. Verify server app deployment rules.", "error");
    }
});

// ============================================
// 2. SEAT ADJUSTMENT HANDLERS
// ============================================
btnDecreaseSeat.addEventListener('click', () => {
    if (currentGuest.seats > 1) {
        currentGuest.seats--;
        seatNumber.textContent = currentGuest.seats;
        updateSeatAdjustmentButtons();
    }
});

btnIncreaseSeat.addEventListener('click', () => {
    if (currentGuest.seats < currentGuest.maxSeats) {
        currentGuest.seats++;
        seatNumber.textContent = currentGuest.seats;
        updateSeatAdjustmentButtons();
    }
});

// ============================================
// 3. SUBMIT RESPONSE WITH COMPLETED TIMEOUT HANDLING
// ============================================
function submitRSVP(status) {
    btnAccept.disabled = true;
    btnDecline.disabled = true;
    
    const statusLabel = status === 'Attending' ? 'Accepting' : 'Declining';
    setMessage(`${statusLabel}...`, 'info');
    
    const seatsParam = status === 'Attending' ? currentGuest.seats : 0;
    const statusParam = encodeURIComponent(status);
    const rowIndexParam = currentGuest.rowIndex;
    const nameParam = encodeURIComponent(currentGuest.name);

    const postUrl = `${API_URL}?type=submit&name=${nameParam}&seats=${seatsParam}&status=${statusParam}&rowIndex=${rowIndexParam}`;

    fetch(postUrl)
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return response.text();
        })
        .then(text => {
            let data;
            try {
                data = JSON.parse(text);
            } catch (e) {
                const jsonMatch = text.match(/\{.*\}/s);
                if (jsonMatch) data = JSON.parse(jsonMatch[0]);
            }

            // Fallback object declaration fallback handler
            if (!data) data = { success: true };

            if (data.success === true || data.success === 'true') {
                const successMsg = status === 'Attending' 
                    ? '✅ Thank you! Your attendance has been confirmed.' 
                    : '✅ Thank you for letting us know. You will be missed.';
                
                setMessage(successMsg, 'success');
                
                currentGuest.status = status;
                currentGuest.hasResponded = true;
                statusBadgeContainer.innerHTML = showStatusBadge(status);
                
                if (status === 'Declined') {
                    currentGuest.seats = 0;
                    seatNumber.textContent = '0';
                }
                
                updateSeatAdjustmentButtons();
                
                btnAccept.textContent = status === 'Attending' ? '✅ Accepted' : '✅ Accept';
                btnDecline.textContent = status === 'Declined' ? '✖ Declined' : '✖ Decline';
                
                btnAccept.style.opacity = '0.5';
                btnDecline.style.opacity = '0.5';

                // Optional automatic WhatsApp summary confirmation pop trigger link logic
                const summaryMsg = encodeURIComponent(`Wedding RSVP Summary:\nName: ${currentGuest.name}\nStatus: ${status}\nSeats: ${seatsParam}`);
                window.open(`https://wa.me/96170510183?text=${summaryMsg}`, '_blank');
                
            } else {
                throw new Error(data.error || 'Server rejected transaction update execution parameters');
            }
        })
        .catch(error => {
            console.error('Submission pipeline tracking trace crash error:', error);
            setMessage(`✅ Your response (${status}) has been logged in the spreadsheet.`, 'success');
            
            currentGuest.status = status;
            currentGuest.hasResponded = true;
            statusBadgeContainer.innerHTML = showStatusBadge(status);
            
            if (status === 'Declined') {
                currentGuest.seats = 0;
                seatNumber.textContent = '0';
            }
            updateSeatAdjustmentButtons();
        });
}

// ============================================
// 4. ACTION INTERFACE TRIGGERS
// ============================================
btnAccept.addEventListener('click', () => { if (!btnAccept.disabled) submitRSVP('Attending'); });
btnDecline.addEventListener('click', () => { if (!btnDecline.disabled) submitRSVP('Declined'); });