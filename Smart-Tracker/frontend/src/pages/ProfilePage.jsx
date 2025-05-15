import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import styles from './ProfilePage.module.css'; // Ensure this path is correct
import { FaEdit, FaPen } from 'react-icons/fa';

function ProfilePage() {
  const [userProfile, setUserProfile] = useState(null);
  const [totalSavings, setTotalSavings] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // State for editing name
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [isSubmittingName, setIsSubmittingName] = useState(false); // Specific submit state

  // State for email editing
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [isSubmittingEmail, setIsSubmittingEmail] = useState(false); // Specific submit state for OTP send
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);

  // State for profile picture
  const [profilePicture, setProfilePicture] = useState(null);
  const [isUploadingProfilePic, setIsUploadingProfilePic] = useState(false);
  const fileInputRef = useRef(null);

  // State for full-screen modal
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Handlers for modal (Keep these as they are)
  const openModal = () => { /* ... */ };
  const closeModal = () => { /* ... */ };
  const handleModalImageClick = (e) => { /* ... */ };
  // --- useEffect and other handlers (keep them as in your last provided version) ---
  // ... (fetchProfileData, handleEditName, handleSaveName, etc.) ...
  // ... (ensure specific submitting states like isSubmittingName, isSubmittingEmail, isVerifyingOtp are used)

  useEffect(() => {
    const fetchProfileData = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem('authToken');
        if (!token) {
          throw new Error("Authentication token not found.");
        }
        const profileResponse = await fetch('/api/users/me', {
          headers: { 'Authorization': `Bearer ${token}` },
        });

        if (!profileResponse.ok) {
          let errorData;
          try {
            errorData = await profileResponse.json();
          } catch (e) {
            errorData = { message: profileResponse.statusText };
          }
          throw new Error(errorData.message || `Failed to fetch profile data: ${profileResponse.status}`);
        }
        const profileData = await profileResponse.json();
        setUserProfile(profileData);
        setNewName(profileData.name || '');
        setProfilePicture(profileData.profilePicture || null);

        const savingsResponse = await fetch('/api/transactions/savings/monthly', {
             headers: { 'Authorization': `Bearer ${token}` },
        });

        if (!savingsResponse.ok) {
            let errorData;
            try {
                errorData = await savingsResponse.json();
            } catch (e) {
                errorData = { message: savingsResponse.statusText };
            }
             throw new Error(errorData.message || `Failed to fetch monthly savings data: ${savingsResponse.status}`);
        }
        const monthlySavingsData = await savingsResponse.json();
        const calculatedTotalSavings = monthlySavingsData.reduce((sum, monthData) => sum + monthData.savings, 0);
        setTotalSavings(calculatedTotalSavings);

      } catch (err) {
        console.error("Error fetching profile or savings data:", err);
        toast.error(`Failed to load profile data: ${err.message}`);
        setError(`Failed to load profile data: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, []);

  const handleEditName = () => {
    setNewName(userProfile?.name || '');
    setIsEditingName(true);
  };

  const handleSaveName = async () => {
    if (!newName.trim()) {
        toast.error("Name cannot be empty.");
        return;
    }
    setIsSubmittingName(true);
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/users/me/name', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newName }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        toast.error(errorData.message || 'Failed to update name');
        throw new Error(errorData.message || 'Failed to update name');
      }
      const updatedProfile = await response.json();
      setUserProfile(updatedProfile);
      setIsEditingName(false);
      toast.success("Name updated successfully!");
    } catch (err) {
      console.error("Error updating name:", err);
      toast.error(`Failed to update name: ${err.message}`);
    } finally {
      setIsSubmittingName(false);
    }
  };

   const handleCancelEditName = () => {
    setNewName(userProfile.name || '');
    setIsEditingName(false);
  };

  const handleEditEmail = () => {
    setNewEmail(userProfile?.email || '');
    setIsEditingEmail(true);
    setIsOtpSent(false);
    setOtp('');
  };

  const handleSendOtp = async () => {
    if (!newEmail) {
        toast.error("Please enter the new email address first.");
        return;
    }
    // Basic email format validation (optional, backend should validate too)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
        toast.error("Please enter a valid email address.");
        return;
    }
    if (newEmail === userProfile?.email) {
        toast.info("This is already your current email address.");
        return;
    }

    const confirmSend = window.confirm(`Send OTP to ${newEmail}?`);
    if (confirmSend) {
      setIsSubmittingEmail(true);
      try {
        // const token = localStorage.getItem('authToken'); // Not needed if send-otp is public
        const response = await fetch('/api/users/send-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: newEmail }),
        });
        if (!response.ok) {
          const errorData = await response.json();
          toast.error(errorData.message || 'Failed to send OTP');
          throw new Error(errorData.message || 'Failed to send OTP');
        }
        toast.success("OTP sent successfully! Please check your inbox and spam folder.");
        setIsOtpSent(true);
      } catch (err) {
        console.error("Error sending OTP:", err);
        toast.error(`Failed to send OTP: ${err.message}`);
      } finally {
        setIsSubmittingEmail(false);
      }
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp.trim()) {
        toast.error("Please enter the OTP.");
        return;
    }
    setIsVerifyingOtp(true);
    try {
      const token = localStorage.getItem('authToken');
      const updateEmailResponse = await fetch('/api/users/me/update-email', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ newEmail: newEmail, otp: otp }),
      });

      if (!updateEmailResponse.ok) {
        let errorData;
        try {
            errorData = await updateEmailResponse.json();
        } catch (e) {
            errorData = { message: updateEmailResponse.statusText || `HTTP error! status: ${updateEmailResponse.status}` };
        }
        toast.error(errorData.message || 'Failed to update email');
        throw new Error(errorData.message || 'Failed to update email');
      }

      const updatedProfile = await updateEmailResponse.json();
      setUserProfile(updatedProfile);
      setIsEditingEmail(false);
      setIsOtpSent(false);
      setOtp('');
      setNewEmail('');
      toast.success("Email updated successfully!");
    } catch (err) {
      console.error("Error during email update process:", err);
      if (!toast.isActive('error-toast')) {
        toast.error(`Error: ${err.message}`, { toastId: 'error-toast'});
      }
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleCancelEditEmail = () => {
    setIsEditingEmail(false);
    setIsOtpSent(false);
    setOtp('');
    setNewEmail(userProfile?.email || '');
  };

  const handleProfilePicChange = async (event) => {
      const file = event.target.files[0];
      if (!file) return;
      // Simple file type validation
      if (!file.type.startsWith('image/')) {
          toast.error("Please select an image file (e.g., JPG, PNG).");
          return;
      }
      // Simple file size validation (e.g., 2MB)
      if (file.size > 2 * 1024 * 1024) {
          toast.error("Image size should be less than 2MB.");
          return;
      }

      setIsUploadingProfilePic(true);
      // setError(null); // Error state is for general page load error

      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onloadend = async () => {
          const base64String = reader.result;
          try {
              const token = localStorage.getItem('authToken');
              const response = await fetch('/api/users/me/profile-picture', {
                  method: 'PUT',
                  headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${token}`,
                  },
                  body: JSON.stringify({ profilePicture: base64String }),
              });

              if (!response.ok) {
                  const errorData = await response.json();
                  toast.error(errorData.message || 'Failed to upload profile picture');
                  throw new Error(errorData.message || 'Failed to upload profile picture');
              }
              const updatedProfile = await response.json();
              setProfilePicture(updatedProfile.profilePicture);
              setUserProfile(prevProfile => ({...prevProfile, profilePicture: updatedProfile.profilePicture}));
              toast.success("Profile picture updated!");
          } catch (err) {
              console.error("Error uploading profile picture:", err);
              toast.error(`Failed to upload profile picture: ${err.message}`);
          } finally {
              setIsUploadingProfilePic(false);
          }
      };
      reader.onerror = (err) => {
          console.error("Error reading file:", err);
          toast.error("Failed to read file.");
          setIsUploadingProfilePic(false);
      };
  };

  const handleEditProfilePicClick = () => {
      const confirmChange = window.confirm("Change profile picture?");
      if (confirmChange) {
          fileInputRef.current.click();
      }
  };

  if (loading) {
    return <div className={styles.profileContainer}><p>Loading profile data...</p></div>;
  }

  if (error && !userProfile) {
    return <div className={styles.profileContainer}><p className={styles.error}>Error: {error}</p></div>;
  }

  if (!userProfile) {
      return <div className={styles.profileContainer}><p>User profile not found. Please try logging in again.</p></div>;
  }


  return (
    <div className={styles.profileContainer}>
      <h1 className={styles.pageTitle}>User Profile</h1>

      <section className={styles.profileSection}>
        <div className={styles.profilePicContainer}>
          {profilePicture ? (
            <img
                src={profilePicture}
                alt="Profile"
                className={styles.profilePic}
                onClick={openModal}
            />
          ) : (
            <div className={styles.profilePicPlaceholder}>No Picture</div>
          )}
          <input
              type="file"
              accept="image/*"
              onChange={handleProfilePicChange}
              style={{ display: 'none' }}
              id="profilePicInput"
              ref={fileInputRef}
              disabled={isUploadingProfilePic}
          />
          {profilePicture && (
              <button
                  className={styles.editProfilePicButton}
                  onClick={handleEditProfilePicClick}
                  disabled={isUploadingProfilePic}
                  title="Change profile picture"
              >
                  <FaEdit />
              </button>
          )}
           {!profilePicture && (
               <label htmlFor="profilePicInput" className={`${styles.button} ${styles.addProfilePicButton}`} disabled={isUploadingProfilePic}>
                   {isUploadingProfilePic ? 'Uploading...' : 'Add Picture'}
               </label>
           )}
        </div>

        <div className={styles.profileDetails}>
          {/* --- Name Field --- */}
          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>Name:</span>
            {isEditingName ? (
              <div className={styles.editFieldContainer}>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className={styles.editInput}
                  disabled={isSubmittingName}
                  placeholder="Enter your name"
                />
                <div className={styles.actionButtonsContainer}>
                  <button onClick={handleSaveName} className={styles.saveButton} disabled={isSubmittingName}>
                    {isSubmittingName ? "Saving..." : "Save"}
                  </button>
                  <button onClick={handleCancelEditName} className={styles.cancelButton} disabled={isSubmittingName}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <span className={styles.detailValue}>{userProfile.name}</span>
                <button onClick={handleEditName} className={styles.editButtonInline} title="Edit name"><FaPen /></button>
              </>
            )}
          </div>

          {/* --- Email Field --- */}
          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>Email:</span>
            {isEditingEmail ? (
              <div className={styles.editFieldContainer}>
                {!isOtpSent ? (
                  <div className={styles.editFieldInputAndActions}> {/* Group input and Send OTP button */}
                    <input
                      type="email"
                      placeholder="Enter new email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className={styles.editInput}
                      disabled={isSubmittingEmail}
                    />
                    <button onClick={handleSendOtp} className={styles.actionButton} disabled={isSubmittingEmail}>
                      {isSubmittingEmail ? "Sending..." : "Send OTP"}
                    </button>
                  </div>
                ) : (
                  <div className={styles.editFieldInputAndActions}> {/* Group input and Verify button */}
                    <input
                      type="text"
                      placeholder="Enter OTP"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      className={styles.editInput}
                      disabled={isVerifyingOtp}
                      maxLength={6} // Assuming 6-digit OTP
                    />
                    <button onClick={handleVerifyOtp} className={styles.actionButton} disabled={isVerifyingOtp}>
                      {isVerifyingOtp ? "Verifying..." : "Verify & Update"}
                    </button>
                  </div>
                )}
                {/* Cancel button is always present in edit mode for email, but outside the immediate input/action group */}
                <div className={styles.actionButtonsContainer} style={{ justifyContent: 'flex-end', marginTop: !isOtpSent ? '0' : '10px' }}>
                    {/* On larger screens, this cancel button might look better aligned with Save/Verify */}
                    {/* Or it can be a standalone smaller button */}
                    <button onClick={handleCancelEditEmail} className={styles.cancelButton} disabled={isSubmittingEmail || isVerifyingOtp}>
                        Cancel
                    </button>
                </div>
              </div>
            ) : (
              <>
                <span className={styles.detailValue}>{userProfile.email}</span>
                <button onClick={handleEditEmail} className={styles.editButtonInline} title="Edit email"><FaPen /></button>
              </>
            )}
          </div>

          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>Registered:</span>
            <span className={styles.detailValue}>
                {userProfile.createdAt ? new Date(userProfile.createdAt).toLocaleDateString() : 'N/A'}
            </span>
          </div>

          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>Total Savings:</span>
            <span className={styles.detailValue}>₹{totalSavings.toFixed(2)}</span>
          </div>
        </div>
      </section>

      {/* Full-screen modal for profile picture */}
      {isModalOpen && (
        <div className={styles.modalOverlay} onClick={closeModal}>
            <div className={styles.modalContent} onClick={handleModalImageClick}>
                <img
                    src={profilePicture}
                    alt="Profile"
                    className={styles.modalImage}
                />
            </div>
        </div>
      )}
    </div>
  );
}

export default ProfilePage;