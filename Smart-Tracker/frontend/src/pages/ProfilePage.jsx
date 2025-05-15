import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import styles from './ProfilePage.module.css';
import { FaEdit, FaPen } from 'react-icons/fa';

function ProfilePage() {
  const [userProfile, setUserProfile] = useState(null);
  const [totalSavings, setTotalSavings] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // State for editing name
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // State for email editing
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [newEmail, setNewEmail] = useState(''); // This will hold the new email address the user types
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);

  // State for profile picture
  const [profilePicture, setProfilePicture] = useState(null);
  const [isUploadingProfilePic, setIsUploadingProfilePic] = useState(false);
  const fileInputRef = useRef(null);

  // State for full-screen modal
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Handlers for modal
  const openModal = () => {
      if (profilePicture) { // Only open modal if a profile picture exists
          setIsModalOpen(true);
      }
  };

  const closeModal = () => {
      setIsModalOpen(false);
  };

  const handleModalImageClick = (e) => {
      e.stopPropagation(); // Prevent modal from closing when clicking the image
  };


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
        // setNewEmail(profileData.email || ''); // Initialize newEmail with current email when editing starts
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
    setNewName(userProfile?.name || ''); // Ensure newName is set when editing starts
    setIsEditingName(true);
  };

  const handleSaveName = async () => {
    setIsSubmitting(true);
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
      setIsSubmitting(false);
    }
  };

   const handleCancelEditName = () => {
    setNewName(userProfile.name || '');
    setIsEditingName(false);
  };

  const handleEditEmail = () => {
    setNewEmail(userProfile?.email || ''); // Initialize newEmail with current email
    setIsEditingEmail(true);
    setIsOtpSent(false); // Reset OTP state
    setOtp('');
  };

  const handleSendOtp = async () => {
    if (!newEmail) {
        toast.error("Please enter the new email address first.");
        return;
    }
    const confirmSend = window.confirm(`Send OTP to ${newEmail}?`);
    if (confirmSend) {
      setIsSubmitting(true); // Use general submitting state or a specific one for OTP
      try {
        const token = localStorage.getItem('authToken');
        // The backend sendOTP expects 'email' in the body for where to send the OTP
        const response = await fetch('/api/users/send-otp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // 'Authorization': `Bearer ${token}`, // send-otp is public, token might not be needed by backend
          },
          body: JSON.stringify({ email: newEmail }), // Send the newEmail to receive OTP
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
        setIsSubmitting(false);
      }
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp) {
        toast.error("Please enter the OTP.");
        return;
    }
    setIsVerifyingOtp(true);
    try {
      const token = localStorage.getItem('authToken');

      // Step 1: Verify OTP (Optional, as updateEmail endpoint also verifies OTP)
      // If your /api/users/me/update-email endpoint handles OTP verification internally,
      // you might not need a separate /api/users/verify-otp call here.
      // For this example, let's assume /api/users/me/update-email takes newEmail and otp.
      // If you have a separate verify-otp route that should be called first, uncomment and adjust.

      /*
      const verifyOtpResponse = await fetch('/api/users/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // 'Authorization': `Bearer ${token}`, // If verify-otp is protected
        },
        body: JSON.stringify({ email: newEmail, otp: otp }), // OTP was sent to newEmail
      });

      if (!verifyOtpResponse.ok) {
        let errorData;
        try {
            errorData = await verifyOtpResponse.json();
        } catch (e) {
            errorData = { message: verifyOtpResponse.statusText }
        }
        toast.error(errorData.message || 'Failed to verify OTP');
        throw new Error(errorData.message || 'Failed to verify OTP');
      }
      // If verify-otp is successful, proceed to update email
      */

      // Update the email address - this endpoint should verify the OTP
      // The backend's updateEmail expects 'newEmail' and 'otp' in the body
      const updateEmailResponse = await fetch('/api/users/me/update-email', { //  CORRECTED URL
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`, // This route is protected
        },
        // Send 'newEmail' (the target email) and 'otp'
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
      setUserProfile(updatedProfile); // Update user profile with new email
      setIsEditingEmail(false);
      setIsOtpSent(false);
      setOtp('');
      setNewEmail(''); // Clear new email field
      toast.success("Email updated successfully!");
    } catch (err) {
      console.error("Error during email update process:", err);
      // The toast error might have already been shown by individual fetch failures
      if (!toast.isActive('error-toast')) { // Prevent duplicate toasts if already shown
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
    setNewEmail(userProfile?.email || ''); // Reset to original email
  };


  const handleProfilePicChange = async (event) => {
      const file = event.target.files[0];
      if (!file) return;

      setIsUploadingProfilePic(true);
      setError(null);

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

  // Display general error if exists after loading
  if (error && !userProfile) { // Only show general error if profile couldn't be loaded at all
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
            <div className={styles.profilePicPlaceholder}>No Profile Picture</div>
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
               <label htmlFor="profilePicInput" className={styles.addProfilePicButton} disabled={isUploadingProfilePic}>
                   {isUploadingProfilePic ? 'Uploading...' : 'Add Picture'}
               </label>
           )}
        </div>

        <div className={styles.profileDetails}>
          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>Name:</span>
            {isEditingName ? (
              <div className={styles.editFieldContainer}>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className={styles.editInput}
                  disabled={isSubmitting}
                />
                <button onClick={handleSaveName} className={styles.saveButton} disabled={isSubmitting}>Save</button>
                <button onClick={handleCancelEditName} className={styles.cancelButton} disabled={isSubmitting}>Cancel</button>
              </div>
            ) : (
              <>
                <span className={styles.detailValue}>{userProfile.name}</span>
                <button onClick={handleEditName} className={styles.editButtonInline} title="Edit name"><FaPen /></button>
              </>
            )}
          </div>

          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>Email:</span>
            {isEditingEmail ? (
              <div className={styles.editFieldContainer}>
                {!isOtpSent ? (
                  <>
                    <input
                      type="email"
                      placeholder="Enter new email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className={styles.editInput}
                      disabled={isSubmitting}
                    />
                    <button onClick={handleSendOtp} className={styles.actionButton} disabled={isSubmitting}>
                      Send OTP
                    </button>
                  </>
                ) : (
                  <>
                    <input
                      type="text"
                      placeholder="Enter OTP"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      className={styles.editInput}
                      disabled={isVerifyingOtp}
                    />
                    <button onClick={handleVerifyOtp} className={styles.saveButton} disabled={isVerifyingOtp}>
                      {isVerifyingOtp ? "Verifying..." : "Verify & Update"}
                    </button>
                  </>
                )}
                 <button onClick={handleCancelEditEmail} className={styles.cancelButton} disabled={isSubmitting || isVerifyingOtp}>Cancel</button>
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
                {new Date(userProfile.createdAt).toLocaleDateString()}
            </span>
          </div>

          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>Total Savings:</span>
            <span className={styles.detailValue}>₹{totalSavings.toFixed(2)}</span>
          </div>
        </div>
      </section>

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