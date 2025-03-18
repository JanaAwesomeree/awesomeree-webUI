document.addEventListener('DOMContentLoaded', async function() {
  // -------------------------
  // Repairs History Loading
  // -------------------------
  async function loadRepairHistory() {
    const historyTable = document.getElementById('repairsHistoryTable');
    historyTable.innerHTML = `
      <tr>
        <td colspan="11" class="text-center">
          <div class="spinner-border spinner-border-sm" role="status"></div>
          Loading repair history...
        </td>
      </tr>
    `;
    try {
      const repairHistory = await getRepairHistory();
      console.log('Repair history data:', repairHistory);
      if (repairHistory.length === 0) {
        historyTable.innerHTML = '<tr><td colspan="11" class="text-center">No repair requests found</td></tr>';
        return;
      }
      historyTable.innerHTML = '';
      repairHistory.forEach(item => {
        addToRepairHistory(item, false);
      });
      
      // Add event listeners to all edit buttons
      document.querySelectorAll('.edit-repair-btn').forEach(button => {
        button.addEventListener('click', function() {
          const repairId = this.closest('tr').dataset.repairId;
          editRepair(repairId);
        });
      });
      
      // Add event listeners to all dropdown buttons
      document.querySelectorAll('.dropdown-repair-btn').forEach(button => {
        button.addEventListener('click', function() {
          const repairId = this.closest('tr').dataset.repairId;
          // Show delete option in a dropdown
          const menu = document.createElement('div');
          menu.className = 'dropdown-menu show';
          menu.style.position = 'absolute';
          menu.style.transform = 'translate3d(0px, 38px, 0px)';
          menu.style.top = '0px';
          menu.style.left = '0px';
          menu.style.willChange = 'transform';
          menu.innerHTML = `
            <a class="dropdown-item text-danger delete-repair-item" href="#" data-repair-id="${repairId}">
              <i class="bi bi-trash"></i> Delete
            </a>
          `;
          
          // Position the dropdown
          const rect = this.getBoundingClientRect();
          menu.style.top = `${rect.bottom}px`;
          menu.style.left = `${rect.left}px`;
          
          // Add to the document
          document.body.appendChild(menu);
          
          // Event listener for the delete option
          menu.querySelector('.delete-repair-item').addEventListener('click', function(e) {
            e.preventDefault();
            const repairId = this.dataset.repairId;
            confirmDeleteRepair(repairId);
            document.body.removeChild(menu);
          });
          
          // Close dropdown when clicking elsewhere
          const closeDropdown = function() {
            if (document.body.contains(menu)) {
              document.body.removeChild(menu);
            }
            document.removeEventListener('click', closeDropdown);
          };
          
          // Delay adding the event listener to avoid immediate closure
          setTimeout(() => {
            document.addEventListener('click', closeDropdown);
          }, 100);
        });
      });
    } catch (error) {
      console.error('Failed to load repair history:', error);
      historyTable.innerHTML = `
        <tr>
          <td colspan="11" class="text-center text-danger">
            Failed to load repair history. Please try again.
          </td>
        </tr>
      `;
    }
  }

  async function getRepairHistory() {
    const response = await fetch('/api/repairs');
    if (!response.ok) {
      throw new Error('Failed to fetch repair history');
    }
    return await response.json();
  }

  function addToRepairHistory(item, navigateToHistory = true) {
    const historyTable = document.getElementById('repairsHistoryTable');
    // Clear any "no data" row
    if (historyTable.querySelector('td[colspan="11"]')) {
      historyTable.innerHTML = '';
    }
    
    // Helper to format dates (assumes YYYY-MM-DD or ISO format)
    const formatDate = (dateString) => {
      if (!dateString) return 'N/A';
      try {
        const d = new Date(dateString);
        if (isNaN(d.getTime())) return dateString;
        return d.toLocaleDateString();
      } catch (e) {
        console.error('Error formatting date:', e);
        return dateString;
      }
    };
    
    // Safely extract order_id
    const displayOrderId = item.order_id ? String(item.order_id) : '';
    
    // Format submission date
    const submissionDate = item.submittedAt ? new Date(item.submittedAt).toLocaleString() : '';

    // Build clickable links for media using our refresh endpoint
    let mediaLinks = 'No media';
    try {
      const mediaArray = JSON.parse(item.media || '[]');
      if (Array.isArray(mediaArray) && mediaArray.length > 0) {
        mediaLinks = mediaArray
          .map(fileName => `<a href="#" onclick="refreshRepairSignedUrl('${fileName}', this); return false;">View</a>`)
          .join(' | ');
      }
    } catch (e) {
      console.error('Error parsing repair media URLs:', e);
    }
    
    // Create the row with 11 columns (following your UI design)
    const row = document.createElement('tr');
    row.dataset.repairId = item.repair_id; // Store repair_id as data attribute for edit/delete
    
    row.innerHTML = `
      <td class="repair-id">${item.repair_id || 'N/A'}</td>
      <td class="receive-date">${formatDate(item.receive_date)}</td>
      <td class="repair-date">${formatDate(item.repair_date)}</td>
      <td class="purpose">${item.purpose || ''}</td>
      <td class="order-id">${displayOrderId}</td>
      <td class="variation">${item.variation || ''}</td>
      <td class="issue">${item.issue || ''}</td>
      <td class="actions">${item.actions || ''}</td>
      <td class="applicant">${item.applicant || 'anonymous'}</td>
      <td class="media">${mediaLinks}</td>
      <td class="edit-delete">
        <button class="btn btn-sm btn-outline-primary edit-repair-btn">
          <i class="bi bi-pencil"></i> Edit
        </button>
        <button class="btn btn-sm btn-outline-secondary dropdown-repair-btn">
          <i class="bi bi-three-dots-vertical"></i>
        </button>
      </td>
    `;
    
    // Add event listeners to the buttons directly
    const editBtn = row.querySelector('.edit-repair-btn');
    editBtn.addEventListener('click', function() {
      editRepair(item.repair_id);
    });
    
    const dropdownBtn = row.querySelector('.dropdown-repair-btn');
    dropdownBtn.addEventListener('click', function() {
      // Create dropdown with delete option
      const menu = document.createElement('div');
      menu.className = 'dropdown-menu show';
      menu.style.position = 'absolute';
      menu.style.transform = 'translate3d(0px, 38px, 0px)';
      menu.style.top = '0px';
      menu.style.left = '0px';
      menu.style.willChange = 'transform';
      menu.innerHTML = `
        <a class="dropdown-item text-danger delete-repair-item" href="#" data-repair-id="${item.repair_id}">
          <i class="bi bi-trash"></i> Delete
        </a>
      `;
      
      // Position the dropdown
      const rect = this.getBoundingClientRect();
      menu.style.top = `${rect.bottom}px`;
      menu.style.left = `${rect.left}px`;
      
      // Add to the document
      document.body.appendChild(menu);
      
      // Event listener for the delete option
      menu.querySelector('.delete-repair-item').addEventListener('click', function(e) {
        e.preventDefault();
        const repairId = this.dataset.repairId;
        confirmDeleteRepair(repairId);
        document.body.removeChild(menu);
      });
      
      // Close dropdown when clicking elsewhere
      const closeDropdown = function() {
        if (document.body.contains(menu)) {
          document.body.removeChild(menu);
        }
        document.removeEventListener('click', closeDropdown);
      };
      
      // Delay adding the event listener to avoid immediate closure
      setTimeout(() => {
        document.addEventListener('click', closeDropdown);
      }, 100);
    });
    
    historyTable.prepend(row);
    
    if (navigateToHistory) {
      showPage('repairs-history');
    }
  }

  // -------------------------
  // Edit Repair Functions
  // -------------------------
  window.editRepair = function(repairId) {
    const row = document.querySelector(`tr[data-repair-id="${repairId}"]`);
    if (!row) return;
    
    // Get current values
    const receiveDate = row.querySelector('.receive-date').textContent.trim();
    const repairDate = row.querySelector('.repair-date').textContent.trim();
    const purpose = row.querySelector('.purpose').textContent.trim();
    const orderId = row.querySelector('.order-id').textContent.trim();
    const variation = row.querySelector('.variation').textContent.trim();
    const issue = row.querySelector('.issue').textContent.trim();
    const actions = row.querySelector('.actions').textContent.trim();
    const applicant = row.querySelector('.applicant').textContent.trim();
    
    // Format dates for input fields (convert from locale date to YYYY-MM-DD)
    const formatDateForInput = (dateStr) => {
      if (dateStr === 'N/A') return '';
      try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return '';
        return date.toISOString().split('T')[0]; // Get YYYY-MM-DD part
      } catch (e) {
        return '';
      }
    };

    const receiveInput = formatDateForInput(receiveDate);
    const repairInput = formatDateForInput(repairDate);
    
    // Replace row content with an edit form
    const formHtml = `
      <td>${repairId}</td>
      <td>
        <input type="date" class="form-control form-control-sm edit-receive-date" value="${receiveInput}">
      </td>
      <td>
        <input type="date" class="form-control form-control-sm edit-repair-date" value="${repairInput}">
      </td>
      <td>
        <input type="text" class="form-control form-control-sm edit-purpose" value="${purpose}">
      </td>
      <td>
        <input type="text" class="form-control form-control-sm edit-order-id" value="${orderId}">
      </td>
      <td>
        <input type="text" class="form-control form-control-sm edit-variation" value="${variation}">
      </td>
      <td>
        <input type="text" class="form-control form-control-sm edit-issue" value="${issue}">
      </td>
      <td>
        <input type="text" class="form-control form-control-sm edit-actions" value="${actions}">
      </td>
      <td>
        <input type="text" class="form-control form-control-sm edit-applicant" value="${applicant === 'anonymous' ? '' : applicant}">
      </td>
      <td>
        <div class="text-muted small">Media cannot be edited</div>
      </td>
      <td>
        <button class="btn btn-sm btn-success save-repair-btn" onclick="saveRepair('${repairId}')">
          <i class="bi bi-check"></i> Save
        </button>
        <button class="btn btn-sm btn-secondary cancel-repair-btn" onclick="cancelRepairEdit('${repairId}')">
          <i class="bi bi-x"></i> Cancel
        </button>
      </td>
    `;
    
    // Store original HTML for cancel operation
    row.dataset.originalHtml = row.innerHTML;
    row.innerHTML = formHtml;
  };
  
  // Cancel edit operation
  window.cancelRepairEdit = function(repairId) {
    const row = document.querySelector(`tr[data-repair-id="${repairId}"]`);
    if (!row || !row.dataset.originalHtml) return;
    
    // Restore original HTML
    row.innerHTML = row.dataset.originalHtml;
    delete row.dataset.originalHtml;
  };
  
  // Save edited repair item
  window.saveRepair = async function(repairId) {
    const row = document.querySelector(`tr[data-repair-id="${repairId}"]`);
    if (!row) return;
    
    // Get edited values
    const receiveDate = row.querySelector('.edit-receive-date').value.trim();
    const repairDate = row.querySelector('.edit-repair-date').value.trim();
    const purpose = row.querySelector('.edit-purpose').value.trim();
    const orderId = row.querySelector('.edit-order-id').value.trim();
    const variation = row.querySelector('.edit-variation').value.trim();
    const issue = row.querySelector('.edit-issue').value.trim();
    const actions = row.querySelector('.edit-actions').value.trim();
    const applicant = row.querySelector('.edit-applicant').value.trim() || 'anonymous';
    
    // Validate
    if (!repairId) {
      alert('Repair ID cannot be empty');
      return;
    }
    
    try {
      // Show loading state
      const saveBtn = row.querySelector('.save-repair-btn');
      const originalBtnHtml = saveBtn.innerHTML;
      saveBtn.innerHTML = '<div class="spinner-border spinner-border-sm" role="status"></div> Saving...';
      saveBtn.disabled = true;
      
      // Send update request to the server
      const response = await fetch('/api/updateRepair', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          repair_id: repairId,
          receive_date: receiveDate,
          repair_date: repairDate,
          purpose,
          order_id: orderId,
          variation,
          issue,
          actions,
          applicant
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to update repair item: ${response.status} ${response.statusText}`);
      }
      
      // Get the updated repair data
      let updatedRepair;
      try {
        updatedRepair = await response.json();
      } catch (e) {
        // If server doesn't return JSON, use the values we sent
        updatedRepair = {
          repair_id: repairId,
          receive_date: receiveDate,
          repair_date: repairDate,
          purpose,
          order_id: orderId,
          variation,
          issue,
          actions,
          applicant
        };
      }
      
      // Cancel edit mode to return to normal view
      cancelRepairEdit(repairId);
      
      // Helper to format dates for display
      const formatDateForDisplay = (dateStr) => {
        if (!dateStr) return 'N/A';
        try {
          const date = new Date(dateStr);
          if (isNaN(date.getTime())) return 'N/A';
          return date.toLocaleDateString();
        } catch (e) {
          return 'N/A';
        }
      };
      
      // Update row with new data
      const cells = row.querySelectorAll('td');
      cells[1].textContent = formatDateForDisplay(updatedRepair.receive_date);
      cells[2].textContent = formatDateForDisplay(updatedRepair.repair_date);
      cells[3].textContent = updatedRepair.purpose || '';
      cells[4].textContent = updatedRepair.order_id || '';
      cells[5].textContent = updatedRepair.variation || '';
      cells[6].textContent = updatedRepair.issue || '';
      cells[7].textContent = updatedRepair.actions || '';
      cells[8].textContent = updatedRepair.applicant || 'anonymous';
      
      // Show success message
      showToast('Success', 'Repair item updated successfully');
      
    } catch (error) {
      console.error('Error updating repair item:', error);
      alert(`Failed to update repair item: ${error.message}`);
      
      // Restore save button
      const saveBtn = row.querySelector('.save-repair-btn');
      if (saveBtn) {
        saveBtn.innerHTML = '<i class="bi bi-check"></i> Save';
        saveBtn.disabled = false;
      }
    }
  };
  
  // Confirm delete operation
  window.confirmDeleteRepair = function(repairId) {
    // Create and show modal for confirmation
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.id = 'deleteRepairConfirmModal';
    modal.setAttribute('tabindex', '-1');
    modal.setAttribute('aria-labelledby', 'deleteRepairConfirmModalLabel');
    modal.setAttribute('aria-hidden', 'true');
    
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="deleteRepairConfirmModalLabel">Confirm Delete</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            Are you sure you want to delete this repair item? This action cannot be undone.
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-danger" onclick="deleteRepair('${repairId}')">Delete</button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Show the modal
    const modalInstance = new bootstrap.Modal(modal);
    modalInstance.show();
    
    // Set up event listener to remove modal from DOM when hidden
    modal.addEventListener('hidden.bs.modal', function() {
      document.body.removeChild(modal);
    });
  };
  
  // Delete repair item
  window.deleteRepair = async function(repairId) {
    try {
      // Hide the modal
      const modal = document.getElementById('deleteRepairConfirmModal');
      const modalInstance = bootstrap.Modal.getInstance(modal);
      modalInstance.hide();
      
      // Show loading indicator
      const row = document.querySelector(`tr[data-repair-id="${repairId}"]`);
      if (row) {
        row.innerHTML = `
          <td colspan="11" class="text-center">
            <div class="spinner-border spinner-border-sm" role="status"></div>
            Deleting...
          </td>
        `;
      }
      
      // Send delete request to the server
      const response = await fetch('/api/deleteRepair', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ repair_id: repairId })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to delete repair item: ${response.status} ${response.statusText}`);
      }
      
      // Remove the row from the table
      if (row) {
        row.remove();
      }
      
      // Check if table is now empty
      const historyTable = document.getElementById('repairsHistoryTable');
      if (historyTable.children.length === 0) {
        historyTable.innerHTML = '<tr><td colspan="11" class="text-center">No repair requests found</td></tr>';
      }
      
      // Show success message
      showToast('Success', 'Repair item deleted successfully');
      
    } catch (error) {
      console.error('Error deleting repair item:', error);
      alert(`Failed to delete repair item: ${error.message}`);
      
      // Refresh the table to restore the original view
      loadRepairHistory();
    }
  };

  // -------------------------
  // Helper function to show toast notifications
  // -------------------------
  function showToast(title, message) {
    // Check if toast container exists, create if not
    let toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
      document.body.appendChild(toastContainer);
    }
    
    // Create toast element
    const toastId = 'toast-' + Date.now();
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.id = toastId;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');
    
    toast.innerHTML = `
      <div class="toast-header">
        <strong class="me-auto">${title}</strong>
        <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
      <div class="toast-body">
        ${message}
      </div>
    `;
    
    toastContainer.appendChild(toast);
    
    // Initialize and show the toast
    const toastInstance = new bootstrap.Toast(toast, {
      autohide: true,
      delay: 3000
    });
    toastInstance.show();
    
    // Remove toast from DOM after it's hidden
    toast.addEventListener('hidden.bs.toast', function() {
      toastContainer.removeChild(toast);
    });
  }

  // -------------------------
  // File Preview for Repair Files
  // -------------------------
  const repairFiles = document.getElementById('repairFiles');
  const repairPreviewContainer = document.getElementById('repairFilePreviewContainer');
  const maxFiles = 5;
  const maxFileSize = 10 * 1024 * 1024; // 10MB

  if (repairFiles) {
    repairFiles.addEventListener('change', function(e) {
      repairPreviewContainer.innerHTML = '';
      const files = Array.from(e.target.files);
      if (files.length > maxFiles) {
        alert(`You can only upload up to ${maxFiles} files.`);
        return;
      }
      files.forEach(file => {
        if (file.size > maxFileSize) {
          alert(`File "${file.name}" exceeds the 10MB size limit.`);
          return;
        }
        createRepairFilePreview(file);
      });
    });
  }

  function createRepairFilePreview(file) {
    const preview = document.createElement('div');
    preview.className = 'file-preview';

    // Remove button clears the preview and resets the file input
    const removeBtn = document.createElement('div');
    removeBtn.className = 'remove-file';
    removeBtn.innerHTML = '<i class="bi bi-x-circle"></i>';
    removeBtn.addEventListener('click', function() {
      repairPreviewContainer.innerHTML = '';
      repairFiles.value = '';
    });

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = evt => {
        const img = document.createElement('img');
        img.src = evt.target.result;
        img.classList.add('preview-image');
        preview.appendChild(img);
      };
      reader.readAsDataURL(file);
    } else if (file.type.startsWith('video/')) {
      const reader = new FileReader();
      reader.onload = evt => {
        const vid = document.createElement('video');
        vid.src = evt.target.result;
        vid.controls = true;
        vid.classList.add('preview-video');
        preview.appendChild(vid);
      };
      reader.readAsDataURL(file);
    } else {
      preview.innerHTML = `
        <div class="d-flex align-items-center justify-content-center h-100">
          <i class="bi bi-file-earmark fs-1"></i>
        </div>
      `;
    }
    preview.appendChild(removeBtn);
    repairPreviewContainer.appendChild(preview);
  }

  // -------------------------
  // Repair Form Submission
  // -------------------------
  const repairItemForm = document.getElementById('repairItemForm');
  if (repairItemForm) {
    repairItemForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      const formData = new FormData(repairItemForm);

      // Show loading state on the submit button
      const submitButton = repairItemForm.querySelector('button[type="submit"]');
      const originalButtonText = submitButton.innerHTML;
      submitButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Submitting...';
      submitButton.disabled = true;
      
      try {
        const response = await fetch('/repairs', {
          method: 'POST',
          body: formData,
        });
        if (!response.ok) {
          throw new Error('Failed to submit repair request');
        }
        alert('Repair request submitted successfully!');
        // Optionally, navigate to the repairs history page
        showPage('repairs-history');
      } catch (error) {
        console.error('Error submitting repair request:', error);
        alert('Failed to submit repair request. Please try again.');
      } finally {
        submitButton.innerHTML = originalButtonText;
        submitButton.disabled = false;
      }
    });
  }

  // -------------------------
  // Refresh Signed URL for a Repair File
  // -------------------------
  window.refreshRepairSignedUrl = async function(fileName, linkElement) {
    try {
      linkElement.textContent = 'Loading...';
      const response = await fetch(`/api/signedUrl?file=${encodeURIComponent(fileName)}`);
      if (!response.ok) {
        throw new Error('Failed to fetch signed URL');
      }
      const data = await response.json();
      const newUrl = data.signedUrl;
      window.open(newUrl, '_blank');
      linkElement.textContent = 'View';
    } catch (error) {
      console.error('Error refreshing signed URL:', error);
      linkElement.textContent = 'Error';
    }
  };

  // -------------------------
  // Page Navigation & Sidebar Toggle
  // -------------------------
  window.showPage = function(pageId) {
    const pages = document.querySelectorAll('.page');
    pages.forEach(page => page.classList.remove('active'));
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
      targetPage.classList.add('active');
      if (pageId === 'repairs-history') {
        loadRepairHistory();
      }
    }
  };

  window.toggleSidebar = function() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('collapsed');
    const content = document.getElementById('content');
    content.classList.toggle('expanded');
  };
});