document.addEventListener('DOMContentLoaded', async function() {
  // Load return history if on the "Return History" page
  if (document.getElementById('return-item-history')) {
    try {
      loadReturnHistory();
    } catch (error) {
      console.error('Error loading return history:', error);
    }
  }
  
  // Initialize dropdown functionality for sidebar
  const returnItemDropdown = document.querySelector('[data-bs-target="#returnItemSubMenu"]');
  if (returnItemDropdown) {
    returnItemDropdown.addEventListener('click', function(e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('data-bs-target'));
      if (target) {
        target.classList.toggle('show');
      }
    });
  }

  // File preview functionality
  const returnFiles = document.getElementById('returnFiles');
  const filePreviewContainer = document.getElementById('filePreviewContainer');
  const maxFiles = 5;
  const maxFileSize = 10 * 1024 * 1024; // 10MB

  if (returnFiles) {
    returnFiles.addEventListener('change', function(e) {
      // Clear old previews
      filePreviewContainer.innerHTML = '';
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
        createFilePreview(file);
      });
    });
  }

  function createFilePreview(file) {
    const preview = document.createElement('div');
    preview.className = 'file-preview';

    // Remove button: clear the file input and previews (for simplicity)
    const removeBtn = document.createElement('div');
    removeBtn.className = 'remove-file';
    removeBtn.innerHTML = '<i class="bi bi-x-circle"></i>';
    removeBtn.addEventListener('click', function() {
      filePreviewContainer.innerHTML = '';
      returnFiles.value = '';
    });

    // Create preview based on file type
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
    filePreviewContainer.appendChild(preview);
  }
  
  // --- Return History Functions ---
  async function loadReturnHistory() {
    const historyTable = document.getElementById('returnHistoryTable');
    historyTable.innerHTML = `
      <tr>
        <td colspan="6" class="text-center">
          <div class="spinner-border spinner-border-sm" role="status"></div>
          Loading return history...
        </td>
      </tr>
    `;
    try {
      const returnHistory = await getReturnHistory();
      if (returnHistory.length === 0) {
        historyTable.innerHTML = '<tr><td colspan="6" class="text-center">No return requests found</td></tr>';
        return;
      }
      historyTable.innerHTML = '';
      returnHistory.forEach(request => {
        addToReturnHistory(request, false);
      });
      
      // Add event listeners to all edit and delete buttons
      document.querySelectorAll('.edit-btn').forEach(button => {
        button.addEventListener('click', function() {
          const returnId = this.closest('tr').dataset.returnId;
          editReturn(returnId);
        });
      });
      
      document.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', function() {
          const returnId = this.closest('tr').dataset.returnId;
          confirmDelete(returnId);
        });
      });
    } catch (error) {
      console.error('Failed to load return history:', error);
      historyTable.innerHTML = `
        <tr>
          <td colspan="6" class="text-center text-danger">
            Failed to load return history. Please try again.
          </td>
        </tr>
      `;
    }
  }
  
  // Use the getSignedUrl endpoint to get a fresh URL on demand
  async function getSignedUrlForFile(fileName) {
    const response = await fetch(`/api/signedUrl?file=${encodeURIComponent(fileName)}`);
    if (!response.ok) {
      throw new Error('Failed to get signed URL');
    }
    const data = await response.json();
    return data.signedUrl;
  }
  
  function addToReturnHistory(request, navigateToHistory = true) {
    const historyTable = document.getElementById('returnHistoryTable');
    if (historyTable.querySelector('td[colspan="6"]')) {
      historyTable.innerHTML = '';
    }
    const submissionDate = request.submittedAt
      ? new Date(request.submittedAt).toLocaleString()
      : '';
    
    // For media, assume we stored file names (JSON array)
    let mediaLinks = 'No media';
    try {
      // Try parsing mediaUrls as JSON array if it's a string
      let mediaArray = [];
      if (typeof request.mediaUrls === 'string') {
        try {
          mediaArray = JSON.parse(request.mediaUrls);
        } catch (e) {
          // If not valid JSON, it might be a single URL
          mediaArray = [request.mediaUrls];
        }
      } else if (Array.isArray(request.mediaUrls)) {
        mediaArray = request.mediaUrls;
      }
      
      if (mediaArray.length > 0) {
        // Create links that fetch a fresh signed URL when clicked
        mediaLinks = mediaArray.map(fileName => {
          return `<a href="#" onclick="refreshSignedUrl('${fileName}', this); return false;">View</a>`;
        }).join(' | ');
      }
    } catch (e) {
      console.error('Error parsing mediaUrls:', e);
    }
    
    const row = document.createElement('tr');
    // Make sure we have an ID to reference, fallback to trackingNumber if id is not available
    const itemId = request.id || request.trackingNumber || Date.now().toString();
    row.dataset.returnId = itemId;
    
    row.innerHTML = `
      <td class="tracking-number">${request.trackingNumber || ''}</td>
      <td class="reason">${request.reason || ''}</td>
      <td class="applicant">${request.applicant || 'anonymous'}</td>
      <td class="submission-date">${submissionDate}</td>
      <td class="media">${mediaLinks}</td>
      <td class="actions">
        <button class="btn btn-sm btn-outline-primary edit-btn">
          <i class="bi bi-pencil"></i> Edit
        </button>
        <button class="btn btn-sm btn-outline-danger delete-btn">
          <i class="bi bi-trash"></i> Delete
        </button>
      </td>
    `;
    
    // Add event listeners to the buttons directly
    const editBtn = row.querySelector('.edit-btn');
    editBtn.addEventListener('click', function() {
      editReturn(itemId);
    });
    
    const deleteBtn = row.querySelector('.delete-btn');
    deleteBtn.addEventListener('click', function() {
      confirmDelete(itemId);
    });
    
    historyTable.prepend(row);
    
    if (navigateToHistory) {
      showPage('return-item-history');
    }
  }
  
  async function getReturnHistory() {
    const response = await fetch('/api/returns');
    if (!response.ok) {
      throw new Error('Failed to fetch return history');
    }
    return await response.json();
  }
  
  // Global function to refresh a signed URL when a "View" link is clicked
  window.refreshSignedUrl = async function(fileName, linkElement) {
    try {
      linkElement.textContent = 'Loading...';
      const newUrl = await getSignedUrlForFile(fileName);
      // Redirect user to the fresh URL
      window.open(newUrl, '_blank');
      // Optionally, update the link's text back to "View"
      linkElement.textContent = 'View';
    } catch (error) {
      console.error('Error refreshing signed URL:', error);
      linkElement.textContent = 'Error';
    }
  };
  
  // Edit return item - Show edit form
  window.editReturn = function(returnId) {
    const row = document.querySelector(`tr[data-return-id="${returnId}"]`);
    if (!row) return;
    
    // Get current values
    const trackingNumber = row.querySelector('.tracking-number').textContent;
    const reason = row.querySelector('.reason').textContent;
    const applicant = row.querySelector('.applicant').textContent;
    
    // Replace row content with an edit form
    const formHtml = `
      <td>
        <input type="text" class="form-control form-control-sm edit-tracking" value="${trackingNumber}">
      </td>
      <td>
        <input type="text" class="form-control form-control-sm edit-reason" value="${reason}">
      </td>
      <td>
        <input type="text" class="form-control form-control-sm edit-applicant" value="${applicant === 'anonymous' ? '' : applicant}">
      </td>
      <td colspan="2">
        <div class="text-muted small">Submission date and media cannot be edited</div>
      </td>
      <td>
        <button class="btn btn-sm btn-success save-btn" onclick="saveReturn('${returnId}')">
          <i class="bi bi-check"></i> Save
        </button>
        <button class="btn btn-sm btn-secondary cancel-btn" onclick="cancelEdit('${returnId}')">
          <i class="bi bi-x"></i> Cancel
        </button>
      </td>
    `;
    
    // Store original HTML for cancel operation
    row.dataset.originalHtml = row.innerHTML;
    row.innerHTML = formHtml;
  };
  
  // Cancel edit operation
  window.cancelEdit = function(returnId) {
    const row = document.querySelector(`tr[data-return-id="${returnId}"]`);
    if (!row || !row.dataset.originalHtml) return;
    
    // Restore original HTML
    row.innerHTML = row.dataset.originalHtml;
    delete row.dataset.originalHtml;
  };
  
  // Save edited return item
  window.saveReturn = async function(returnId) {
    const row = document.querySelector(`tr[data-return-id="${returnId}"]`);
    if (!row) return;
    
    // Get edited values
    const trackingNumber = row.querySelector('.edit-tracking').value.trim();
    const reason = row.querySelector('.edit-reason').value.trim();
    const applicant = row.querySelector('.edit-applicant').value.trim() || 'anonymous';
    
    // Validate
    if (!trackingNumber) {
      alert('Tracking number cannot be empty');
      return;
    }
    
    try {
      // Show loading state
      const saveBtn = row.querySelector('.save-btn');
      const originalBtnHtml = saveBtn.innerHTML;
      saveBtn.innerHTML = '<div class="spinner-border spinner-border-sm" role="status"></div> Saving...';
      saveBtn.disabled = true;
      
      // Send update request to the server
      const response = await fetch('/api/updateReturn', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: returnId,
          trackingNumber,
          reason,
          applicant
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to update return item: ${response.status} ${response.statusText}`);
      }
      
      // Get the updated return data if available
      let updatedReturn;
      try {
        updatedReturn = await response.json();
      } catch (e) {
        // If server doesn't return JSON, use the values we sent
        updatedReturn = {
          trackingNumber,
          reason,
          applicant
        };
      }
      
      // Cancel edit mode to return to normal view
      cancelEdit(returnId);
      
      // Update row with new data
      const cells = row.querySelectorAll('td');
      cells[0].textContent = updatedReturn.trackingNumber || trackingNumber;
      cells[1].textContent = updatedReturn.reason || reason;
      cells[2].textContent = updatedReturn.applicant || applicant;
      
      // Show success message
      showToast('Success', 'Return item updated successfully');
      
    } catch (error) {
      console.error('Error updating return item:', error);
      alert(`Failed to update return item: ${error.message}`);
      
      // Restore save button
      const saveBtn = row.querySelector('.save-btn');
      if (saveBtn) {
        saveBtn.innerHTML = '<i class="bi bi-check"></i> Save';
        saveBtn.disabled = false;
      }
    }
  };
  
  // Confirm delete operation
  window.confirmDelete = function(returnId) {
    // Create and show modal for confirmation
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.id = 'deleteConfirmModal';
    modal.setAttribute('tabindex', '-1');
    modal.setAttribute('aria-labelledby', 'deleteConfirmModalLabel');
    modal.setAttribute('aria-hidden', 'true');
    
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="deleteConfirmModalLabel">Confirm Delete</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            Are you sure you want to delete this return item? This action cannot be undone.
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-danger" onclick="deleteReturn('${returnId}')">Delete</button>
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
  
  // Delete return item
  window.deleteReturn = async function(returnId) {
    try {
      // Hide the modal
      const modal = document.getElementById('deleteConfirmModal');
      const modalInstance = bootstrap.Modal.getInstance(modal);
      modalInstance.hide();
      
      // Show loading indicator
      const row = document.querySelector(`tr[data-return-id="${returnId}"]`);
      if (row) {
        row.innerHTML = `
          <td colspan="6" class="text-center">
            <div class="spinner-border spinner-border-sm" role="status"></div>
            Deleting...
          </td>
        `;
      }
      
      // Send delete request to the server
      const response = await fetch('/api/deleteReturn', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ id: returnId })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to delete return item: ${response.status} ${response.statusText}`);
      }
      
      // Remove the row from the table
      if (row) {
        row.remove();
      }
      
      // Check if table is now empty
      const historyTable = document.getElementById('returnHistoryTable');
      if (historyTable.children.length === 0) {
        historyTable.innerHTML = '<tr><td colspan="6" class="text-center">No return requests found</td></tr>';
      }
      
      // Show success message
      showToast('Success', 'Return item deleted successfully');
      
    } catch (error) {
      console.error('Error deleting return item:', error);
      alert(`Failed to delete return item: ${error.message}`);
      
      // Refresh the table to restore the original view
      loadReturnHistory();
    }
  };
  
  // Helper function to show toast notifications
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
  
  // Page navigation and sidebar toggle functions
  window.showPage = function(pageId) {
    const pages = document.querySelectorAll('.page');
    pages.forEach(page => page.classList.remove('active'));
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
      targetPage.classList.add('active');
      if (pageId === 'return-item-history') {
        loadReturnHistory();
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