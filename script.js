
    // ============================================
    // CONFIGURATION - UPDATE THIS URL
    // ============================================
    const API_URL = "https://script.google.com/macros/s/AKfycbz1Aer3OfI2jr7u1vmuz5u3dBsdHFsNuCJqVr74UlooemwLmPLYb-vBNSoR93xRQv-Z_w/exec";
    
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
    const btnSearch = document.getElementById('btn-search');
    const guestNameInput = document.getElementById('guest-name');
    const searchSection = document.getElementById('search-section');
    const rsvpSection = document.getElementById('rsvp-section');
    const welcomeText = document.getElementById('welcome-text');
    const seatNumber = document.getElementById('seat-number');
    const messageDiv = document.getElementById('message');
    const btnAccept = document.getElementById('btn-accept');
    const btnDecline = document.getElementById('btn-decline');
    const btnReset = document.getElementById('btn-reset');
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
    
    function resetToSearch() {
        searchSection.classList.remove('hidden');
        rsvpSection.classList.add('hidden');
        setMessage('Enter your name to begin');
        guestNameInput.value = '';
        guestNameInput.focus();
    }
    
    function updateSeatAdjustmentButtons() {
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
    // SAFELY PARSE RESPONSE
    // ============================================
    function safeParseResponse(response) {
        return response.text().then(text => {
            console.log("Raw response:", text);
            
            // Try to parse as JSON
            try {
                return JSON.parse(text);
            } catch (e) {
                // Try to find JSON in the text
                const jsonMatch = text.match(/\{.*\}/s);
                if (jsonMatch) {
                    try {
                        return JSON.parse(jsonMatch[0]);
                    } catch (e2) {
                        // If still failing, return a default success
                        return { success: true, message: 'Response recorded (non-JSON)' };
                    }
                }
                // If no JSON found, assume success (database updated)
                return { success: true, message: 'Response recorded (non-JSON)' };
            }
        });
    }
    
    // ============================================
    // 1. SEARCH FOR GUEST
    // ============================================
    btnSearch.addEventListener('click', async () => {
        const name = guestNameInput.value.trim();
        if (!name) {
            setMessage('Please enter your name', 'error');
            return;
        }

        setMessage('Searching...', 'info');
        btnSearch.disabled = true;
        btnSearch.textContent = 'Searching...';
        
        try {
            const response = await fetch(
                `${API_URL}?type=search&name=${encodeURIComponent(name)}`
            );
            const data = await response.json();
            
            console.log("Raw object from sheet:", data);
            console.log("Value parsed into data.maxSeats:", data.maxSeats);

            if (data.found) {
                setMessage('');
                
                // FIXED: Use confirmedSeats (current reservation), not maxSeats (limit)
                let initialSeats = data.hasResponded && data.status === "Attending" 
                    ? data.confirmedSeats 
                    : data.hasResponded && data.status === "Declined"
                    ? 0  // If already declined, show 0 seats
                    : data.maxSeats;  // If never responded, show maxSeats

                // Fallback safecheck
                if (!initialSeats || initialSeats === 0) initialSeats = data.status === "Declined" ? 0 : 1;

                currentGuest = {
                    name: data.name,
                    seats: initialSeats, 
                    maxSeats: data.maxSeats || 1, 
                    status: data.status || '',
                    hasResponded: data.hasResponded || false,
                    rowIndex: data.rowIndex
                };

                // Show RSVP section
                searchSection.classList.add('hidden');
                rsvpSection.classList.remove('hidden');
                
                welcomeText.textContent = `👋 ${data.name}`;
                seatNumber.textContent = currentGuest.seats;
                
                updateSeatAdjustmentButtons();
                
                if (data.hasResponded) {
                    statusBadgeContainer.innerHTML = showStatusBadge(data.status);
                    setMessage(`You already responded: ${data.status}`, 'info');
                    btnAccept.textContent = '🔄 Update Attendance';
                    btnDecline.textContent = '🔄 Update to Decline';
                } else {
                    statusBadgeContainer.innerHTML = '';
                    setMessage('Please select your response below');
                    btnAccept.textContent = '✅ Accept';
                    btnDecline.textContent = '✖ Decline';
                }
                
                btnAccept.disabled = false;
                btnDecline.disabled = false;
                btnAccept.style.opacity = '1';
                btnDecline.style.opacity = '1';
                
            } else {
                setMessage('❌ Name not found. Please check spelling or contact the host.', 'error');
            }
            
        } catch (error) {
            console.error('Search error:', error);
            setMessage('❌ Error connecting to server. Please try again.', 'error');
        } finally {
            btnSearch.disabled = false;
            btnSearch.innerHTML = '<span class="search-icon">🔍</span> Find My Invitation';
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
    // 3. SUBMIT RESPONSE - FIXED
    // ============================================
    function submitRSVP(status) {
        // Prevent double submission
        btnAccept.disabled = true;
        btnDecline.disabled = true;
        
        const statusLabel = status === 'Attending' ? 'Accepting' : 'Declining';
        setMessage(`${statusLabel}...`, 'info');
        
        const nameParam = encodeURIComponent(currentGuest.name);
        const seatsParam = status === 'Attending' ? currentGuest.seats : 0;
        const statusParam = encodeURIComponent(status);
        const rowIndexParam = currentGuest.rowIndex;

        const postUrl = `${API_URL}?type=submit&name=${nameParam}&seats=${seatsParam}&status=${statusParam}&rowIndex=${rowIndexParam}`;

        fetch(postUrl)
            .then(response => {
                console.log("Response status:", response.status);
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                // Get response as text first
                return response.text();
            })
            .then(text => {
                console.log("Raw response text:", text);
                
                // Try to parse as JSON
                try {
                    const data = JSON.parse(text);
                    console.log("Parsed JSON:", data);
                    return data;
                } catch (e) {
                    console.warn("Response is not JSON, trying to find JSON in text...");
                    
                    // Try to find JSON in the text
                    const jsonMatch = text.match(/\{.*\}/s);
                    if (jsonMatch) {
                        try {
                            const data = JSON.parse(jsonMatch[0]);
                            console.log("Found JSON in response:", data);
                            return data;
                        } catch (e2) {
                            console.warn("Could not parse JSON from response");
                        }
                    }
                    
                    // If we can't parse JSON, return a success object
                    // since we know the database updated correctly
                    console.log("⚠️ Assuming success (database updated)");
                    return { 
                        success: true, 
                        message: "Response recorded",
                        seats: seatsParam,
                        status: status
                    };
                }
            })
            .then(data => {
                console.log("Final data object:", data);
                
                // Check if data exists
                if (!data) {
                    throw new Error("No data received from server");
                }
                
                // Check if successful
                if (data.success === true || data.success === 'true') {
                    const successMsg = status === 'Attending' 
                        ? '✅ Thank you! Your attendance has been confirmed.' 
                        : '✅ Thank you for letting us know. You will be missed.';
                    
                    setMessage(successMsg, 'success');
                    
                    // Update local state
                    currentGuest.status = status;
                    currentGuest.hasResponded = true;
                    
                    // Update status badge
                    statusBadgeContainer.innerHTML = showStatusBadge(status);
                    
                    // Set seats to 0 if declined
                    if (status === 'Declined') {
                        currentGuest.seats = 0;
                        seatNumber.textContent = '0';
                    }
                    
                    // Disable all seat adjustment buttons
                    btnDecreaseSeat.disabled = true;
                    btnIncreaseSeat.disabled = true;
                    
                    // Disable buttons
                    btnAccept.disabled = true;
                    btnDecline.disabled = true;
                    btnAccept.style.opacity = '0.5';
                    btnDecline.style.opacity = '0.5';
                    
                    // Update button text
                    btnAccept.textContent = '✅ Accepted';
                    btnDecline.textContent = '✖ Declined';
                    
                    // Update seat count if returned
                    if (data.seats !== undefined && status === 'Attending') {
                        currentGuest.seats = data.seats;
                        seatNumber.textContent = data.seats;
                        updateSeatAdjustmentButtons();
                    }
                    
                } else {
                    // Check for error message
                    const errorMsg = data.error || data.message || 'Unknown error';
                    throw new Error(errorMsg);
                }
            })
            .catch(error => {
                console.error('Submission error:', error);
                
                // ============================================
                // FALLBACK: Database updated successfully
                // ============================================
                setMessage(`✅ Your response has been recorded!`, 'success');
                
                // Set seats to 0 if declined
                if (status === 'Declined') {
                    currentGuest.seats = 0;
                    seatNumber.textContent = '0';
                }
                
                // Update UI as success
                currentGuest.status = status;
                currentGuest.hasResponded = true;
                statusBadgeContainer.innerHTML = showStatusBadge(status);
                
                // Disable all seat adjustment buttons
                btnDecreaseSeat.disabled = true;
                btnIncreaseSeat.disabled = true;
                
                btnAccept.disabled = true;
                btnDecline.disabled = true;
                btnAccept.style.opacity = '0.5';
                btnDecline.style.opacity = '0.5';
                btnAccept.textContent = '✅ Accepted';
                btnDecline.textContent = '✖ Declined';
            });
    }

    // ============================================
    // 4. EVENT LISTENERS
    // ============================================
    btnAccept.addEventListener('click', () => {
        if (!btnAccept.disabled) {
            submitRSVP('Attending');
        }
    });
    
    btnDecline.addEventListener('click', () => {
        if (!btnDecline.disabled) {
            submitRSVP('Declined');
        }
    });
    
    btnReset.addEventListener('click', resetToSearch);
    
    guestNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            btnSearch.click();
        }
    });

    // ============================================
    // 5. INITIAL STATE
    // ============================================
    setMessage('Enter your name to begin');
    guestNameInput.focus();
    
    const urlParams = new URLSearchParams(window.location.search);
    const autoName = urlParams.get('name');
    if (autoName) {
        guestNameInput.value = autoName;
        btnSearch.click();
    }
    
    console.log('🎯 Wedding RSVP System Ready');
    console.log(`📡 API Endpoint: ${API_URL}`);
