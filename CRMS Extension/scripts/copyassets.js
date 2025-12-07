// copyassets.js - Copy allocated assets from one opportunity to another
console.log("Copy Assets script loaded");

// Function to create a toast message (using CurrentRMS's toast system)
function createCopyAssetsToast(message, type = 'info') {
    const toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) {
        console.log(message);
        return;
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <div class="toast-message">
            <p>${message}</p>
        </div>
    `;
    toastContainer.appendChild(toast);

    // Auto-remove after 5 seconds
    setTimeout(() => {
        toast.remove();
    }, 5000);
}

// Main function to copy assets from current opportunity to destination
async function copyAssetsToOpportunity(destinationOpportunityId) {
    try {
        const subdomain = window.location.hostname.split('.')[0];
        const currentOpportunityId = window.location.pathname.match(/\/opportunities\/(\d+)/)[1];

        createCopyAssetsToast(`Starting asset copy to opportunity ${destinationOpportunityId}...`, 'info');

        // Step 1: Get all allocated assets from current page
        const assetCheckboxes = document.querySelectorAll('input.item-select[data-stock-level-id]');
        const assets = [];

        assetCheckboxes.forEach(checkbox => {
            const row = checkbox.closest('tr');
            const statusLabel = row.querySelector('.status-column .label');
            const status = statusLabel ? statusLabel.textContent.trim() : '';

            // Only include items that are allocated, prepared, or booked out
            if (['Booked Out', 'Allocated', 'Prepared'].includes(status)) {
                const stockLevelId = checkbox.getAttribute('data-stock-level-id');
                const assetNumber = checkbox.getAttribute('data-asset-number');

                assets.push({
                    stockLevelId: stockLevelId,
                    assetNumber: assetNumber.replace(/&amp;/g, '&'),
                    status: status
                });
            }
        });

        if (assets.length === 0) {
            createCopyAssetsToast('No allocated assets found on this opportunity', 'error');
            return;
        }

        console.log(`Found ${assets.length} assets to copy:`, assets);
        createCopyAssetsToast(`Found ${assets.length} assets to copy`, 'info');

        // Step 2: Get CSRF token
        const csrfToken = document.querySelector('meta[name="csrf-token"]').content;

        // Step 3: Allocate each asset on destination opportunity
        let successful = 0;
        let failed = 0;
        const failedAssets = [];

        for (const asset of assets) {
            console.log(`Allocating ${asset.assetNumber} (stock_level_id: ${asset.stockLevelId})...`);

            try {
                const formData = new URLSearchParams({
                    'authenticity_token': csrfToken,
                    'opportunity_id': destinationOpportunityId,
                    'store_id': '1',
                    'stock_level_id': asset.stockLevelId,
                    'stock_level_asset_number': asset.assetNumber,
                    'quantity': '1',
                    'view': 'd',
                    'sort': 'path',
                    'free_scan': '0',
                    'mark_as_prepared': '0',
                    'container': '',
                    'mb_client_id': '',
                    'group_scan': '',
                    'group_id': ''
                });

                const allocateResponse = await fetch(
                    `https://${subdomain}.current-rms.com/opportunities/${destinationOpportunityId}/quick_allocate`,
                    {
                        method: 'POST',
                        credentials: 'include',
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                            'X-Requested-With': 'XMLHttpRequest',
                            'X-CSRF-Token': csrfToken
                        },
                        body: formData.toString()
                    }
                );

                if (allocateResponse.ok) {
                    console.log(`✓ Successfully allocated ${asset.assetNumber}`);
                    successful++;
                } else {
                    const errorText = await allocateResponse.text();
                    console.error(`✗ Failed to allocate ${asset.assetNumber}:`, errorText);
                    failed++;
                    failedAssets.push(asset.assetNumber);
                }

            } catch (error) {
                console.error(`✗ Error allocating ${asset.assetNumber}:`, error);
                failed++;
                failedAssets.push(asset.assetNumber);
            }

            // Small delay to avoid overwhelming the server
            await new Promise(resolve => setTimeout(resolve, 300));
        }

        // Step 4: Report results
        console.log(`\n=== COPY ASSETS RESULTS ===`);
        console.log(`Successful: ${successful}`);
        console.log(`Failed: ${failed}`);

        if (failed === 0) {
            createCopyAssetsToast(`✓ Successfully copied ${successful} assets to opportunity ${destinationOpportunityId}`, 'success');
        } else {
            createCopyAssetsToast(`Copied ${successful} assets. Failed: ${failed}. Check console for details.`, 'error');
            console.log('Failed assets:', failedAssets);
        }

        return { successful, failed, failedAssets };

    } catch (error) {
        console.error('Error in copyAssetsToOpportunity:', error);
        createCopyAssetsToast(`Error: ${error.message}`, 'error');
    }
}

// Function to show modal dialog for destination input
function showCopyAssetsDialog() {
    // Create modal overlay
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-backdrop fade in';
    modalOverlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1040;';

    // Create modal dialog
    const modalDialog = document.createElement('div');
    modalDialog.className = 'modal fade in';
    modalDialog.style.cssText = 'display: block; position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 1050; overflow-y: auto; padding: 15px;';
    modalDialog.innerHTML = `
        <div class="modal-dialog" style="max-width: 500px; width: 100%; margin: 30px auto; position: relative;">
            <div class="modal-content">
                <div class="modal-header">
                    <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                        <span aria-hidden="true">&times;</span>
                    </button>
                    <h4 class="modal-title">Copy Assets to Opportunity</h4>
                </div>
                <div class="modal-body">
                    <p>This will copy all allocated, prepared, and booked out assets from this opportunity to the destination opportunity.</p>
                    <div class="form-group">
                        <label for="destination-opp-id">Destination Opportunity ID:</label>
                        <input type="number" class="form-control" id="destination-opp-id" placeholder="Enter opportunity ID" autofocus>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-default" data-dismiss="modal">Cancel</button>
                    <button type="button" class="btn btn-primary" id="confirm-copy-assets">Copy Assets</button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modalOverlay);
    document.body.appendChild(modalDialog);

    // Close modal function
    function closeModal() {
        modalOverlay.remove();
        modalDialog.remove();
    }

    // Event listeners
    modalDialog.querySelector('.close').addEventListener('click', closeModal);
    modalDialog.querySelector('[data-dismiss="modal"]').addEventListener('click', closeModal);

    // Close when clicking the overlay
    modalOverlay.addEventListener('click', closeModal);

    // Close when clicking outside the modal-dialog (on the modal background)
    modalDialog.addEventListener('click', (e) => {
        // Only close if clicking directly on the modal background, not the dialog content
        if (e.target === modalDialog) {
            closeModal();
        }
    });

    // Confirm button
    modalDialog.querySelector('#confirm-copy-assets').addEventListener('click', async () => {
        const destId = modalDialog.querySelector('#destination-opp-id').value;
        if (destId) {
            closeModal();
            await copyAssetsToOpportunity(destId);
        } else {
            alert('Please enter a destination opportunity ID');
        }
    });

    // Enter key to confirm
    modalDialog.querySelector('#destination-opp-id').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            modalDialog.querySelector('#confirm-copy-assets').click();
        }
    });
}

// Check if we're in Detail View and currently on the Functions tab
function isInFunctionsMode() {
    // detailView/detailViewMode are set in content.js when the page loads and when tabs change
    if (typeof detailView === 'undefined' || typeof detailViewMode === 'undefined') {
        return false;
    }

    return detailView && detailViewMode === 'functions';
}

// Add "Copy Assets" button to the Actions dropdown menu
function addCopyAssetsButton() {
    // Check if button already exists
    if (document.getElementById('copy-assets-to-opp')) {
        console.log("Copy Assets button already exists");
        return;
    }

    // Only add button if Functions tab is active (tracked by detailViewMode)
    if (!isInFunctionsMode()) {
        console.log("Functions tab not active - skipping button add");
        return;
    }

    // Find the Actions dropdown menu (the one with "Prepare", "Book out", etc.)
    // It's in the Functions tab, inside the btn-group with the "Action" button
    const actionsDropdown = document.querySelector('#functions .btn-group .dropdown-menu');

    if (actionsDropdown) {
        // Create new menu item
        const newLi = document.createElement('li');
        newLi.innerHTML = `
            <a id="copy-assets-to-opp" href="#">Copy Assets to Opportunity...</a>
        `;

        // Find a good place to insert it (after "Transfer in" or at the end)
        const transferInLi = Array.from(actionsDropdown.querySelectorAll('li')).find(li =>
            li.textContent.includes('Transfer in')
        );

        if (transferInLi) {
            // Insert after "Transfer in"
            transferInLi.parentNode.insertBefore(newLi, transferInLi.nextSibling);
        } else {
            // Otherwise append to the end
            actionsDropdown.appendChild(newLi);
        }

        // Add event listener
        newLi.addEventListener('click', function(e) {
            e.preventDefault();
            console.log("Copy Assets clicked");
            showCopyAssetsDialog();
        });

        console.log("Copy Assets button added to Actions dropdown");
    } else {
        console.log("Actions dropdown not found - copy assets button not added");
    }
}

// Listen for changes driven by the existing detailViewMode updates in content.js
function setupDetailModeWatcher() {
    // Use MutationObserver to catch when the Functions tab content renders (e.g. after switching tabs)
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === 1 && isInFunctionsMode()) {
                    // Give the DOM a moment to finish rendering
                    setTimeout(() => addCopyAssetsButton(), 100);
                }
            });
        });
    });

    const tabContent = document.querySelector('.tab-content');
    if (tabContent) {
        observer.observe(tabContent, {
            childList: true,
            subtree: true
        });
    }

    // Also watch for detailViewMode changes (set by content.js when tabs change)
    let lastMode = typeof detailViewMode !== 'undefined' ? detailViewMode : null;
    setInterval(() => {
        if (typeof detailViewMode === 'undefined') return;

        if (detailViewMode !== lastMode) {
            lastMode = detailViewMode;
            if (isInFunctionsMode()) {
                setTimeout(() => addCopyAssetsButton(), 100);
            }
        }
    }, 300);
}

// Initialize when on detail view page
if (window.location.href.includes('opportunities') && window.location.href.includes('view=d')) {
    // Try to add button immediately (in case Functions tab is already active)
    setTimeout(() => {
        addCopyAssetsButton();
    }, 1000);

    // Set up listeners that leverage the existing detailViewMode tracking
    setTimeout(() => {
        setupDetailModeWatcher();
    }, 1000);
}
