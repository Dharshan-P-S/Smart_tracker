import React, { useState, useEffect, useRef } from 'react';
import styles from './ProfilePage.module.css';
import { FaEdit } from 'react-icons/fa';

function ProfilePage() {
  const [userProfile, setUserProfile] = useState(null);
  const [totalSavings, setTotalSavings] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // State for editing name
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        // --- Fetch User Profile Data ---
        const token = localStorage.getItem('authToken');
        if (!token) {
          throw new Error("Authentication token not found.");
        }
        const profileResponse = await fetch('/api/users/me', {
          headers: { 'Authorization': `Bearer ${token}` },
        });

        if (!profileResponse.ok) {
          const errorData = await profileResponse.json();
          throw new Error(errorData.message || `Failed to fetch profile data: ${profileResponse.statusText}`);
        }
        const profileData = await profileResponse.json();
        setUserProfile(profileData);
        setNewName(profileData.name || '');
        setProfilePicture(profileData.profilePicture || null); // Set profile picture from fetched data

        // --- Fetch and Calculate Total Savings ---
        const savingsResponse = await fetch('/api/transactions/savings/monthly', {
             headers: { 'Authorization': `Bearer ${token}` },
        });

        if (!savingsResponse.ok) {
             const errorData = await savingsResponse.json();
             throw new Error(errorData.message || `Failed to fetch monthly savings data: ${savingsResponse.statusText}`);
        }
        const monthlySavingsData = await savingsResponse.json();
        const calculatedTotalSavings = monthlySavingsData.reduce((sum, monthData) => sum + monthData.savings, 0);
        setTotalSavings(calculatedTotalSavings);


      } catch (err) {
        console.error("Error fetching profile or savings data:", err);
        setError(`Failed to load profile data: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, []);

  // --- Handle Edit Name Actions ---
  const handleEditName = () => {
    setIsEditingName(true);
  };

  const handleSaveName = async () => {
    setIsSubmitting(true);
    // Implement backend call to update name
    // Example:
    // try {
    //   const token = localStorage.getItem('authToken');
    //   const response = await fetch('/api/users/update-name', { // Assuming update endpoint
    //     method: 'PUT',
    //     headers: {
    //       'Content-Type': 'application/json',
    //       'Authorization': `Bearer ${token}`,
    //     },
    //     body: JSON.stringify({ name: newName }),
    //   });
    //   if (!response.ok) {
    //     const errorData = await response.json();
    //     throw new Error(errorData.message || 'Failed to update name');
    //   }
    //   const updatedProfile = await response.json(); // Assuming backend returns updated user object
    //   setUserProfile(updatedProfile);
    //   setIsEditingName(false);
    // } catch (err) {
    //   console.error("Error updating name:", err);
    //   setError(`Failed to update name: ${err.message}`);
    // } finally {
    //   setIsSubmitting(false);
    // }
    alert("Name update functionality not yet implemented."); // Placeholder
    setIsEditingName(false);
    setIsSubmitting(false);
  };

   const handleCancelEditName = () => {
     setNewName(userProfile.name || '');
     setIsEditingName(false);
   };

  // --- Handle Profile Picture Actions ---
  const handleProfilePicChange = async (event) => {
      const file = event.target.files[0];
      if (!file) return;

      setIsUploadingProfilePic(true);
      setError(null); // Clear previous errors

      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onloadend = async () => {
          const base64String = reader.result; // This is the Base64 string

          try {
              const token = localStorage.getItem('authToken');
              const response = await fetch('/api/users/me/profile-picture', { // Use the new endpoint
                  method: 'PUT', // Use PUT method
                  headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${token}`,
                  },
                  body: JSON.stringify({ profilePicture: base64String }), // Send as JSON with profilePicture field
              });

              if (!response.ok) {
                  const errorData = await response.json();
                  throw new Error(errorData.message || 'Failed to upload profile picture');
              }

              const updatedProfile = await response.json(); // Assuming backend returns updated user object
              setProfilePicture(updatedProfile.profilePicture); // Update profile picture state
              setUserProfile(updatedProfile); // Update userProfile state as well

          } catch (err) {
              console.error("Error uploading profile picture:", err);
              setError(`Failed to upload profile picture: ${err.message}`);
          } finally {
              setIsUploadingProfilePic(false);
          }
      };
      reader.onerror = (err) => {
          console.error("Error reading file:", err);
          setError("Failed to read file.");
          setIsUploadingProfilePic(false);
      };
  };

  const handleEditProfilePicClick = () => {
      // Show confirmation dialog
      const confirmChange = window.confirm("Change profile picture?");
      if (confirmChange) {
          // Trigger the hidden file input
          fileInputRef.current.click();
      }
      // If cancel, do nothing
  };


  if (loading) {
    return <div className={styles.profileContainer}><p>Loading profile data...</p></div>;
  }

  if (error) {
    return <div className={styles.profileContainer}><p className={styles.error}>Error: {error}</p></div>;
  }

  if (!userProfile) {
      return <div className={styles.profileContainer}><p>User profile not found.</p></div>;
  }


  return (
    <div className={styles.profileContainer}>
      <h1 className={styles.pageTitle}>User Profile</h1>

      <section className={styles.profileSection}>
        <div className={styles.profilePicContainer}>
          {profilePicture ? ( // Use profilePicture state
            <img
                src={profilePicture}
                alt="Profile"
                className={styles.profilePic}
                onClick={openModal} // Add onClick to open modal
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
              ref={fileInputRef} // Attach ref
              disabled={isUploadingProfilePic}
          />
          {/* Show "Edit" button if profile picture exists */}
          {profilePicture && (
              <button
                  className={styles.editProfilePicButton} // We'll define this style
                  onClick={handleEditProfilePicClick}
                  disabled={isUploadingProfilePic}
              >
                  <FaEdit />
              </button>
          )}
           {/* Show "Add Profile Picture" button if no profile picture exists */}
           {!profilePicture && (
               <label htmlFor="profilePicInput" className={styles.addProfilePicButton} disabled={isUploadingProfilePic}>
                   {isUploadingProfilePic ? 'Uploading...' : 'Add Profile Picture'}
               </label>
           )}
        </div>

        <div className={styles.profileDetails}>
          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>Name:</span>
            {isEditingName ? (
              <>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className={styles.editInput}
                  disabled={isSubmitting}
                />
                <button onClick={handleSaveName} className={styles.saveButton} disabled={isSubmitting}>Save</button>
                <button onClick={handleCancelEditName} className={styles.cancelButton} disabled={isSubmitting}>Cancel</button>
              </>
            ) : (
              <>
                <span className={styles.detailValue}>{userProfile.name}</span>
                <button onClick={handleEditName} className={styles.editButton}>Edit</button>
              </>
            )}
          </div>

          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>Email:</span>
            <span className={styles.detailValue}>{userProfile.email}</span>
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
            <div className={styles.modalContent}>
                <img
                    src={profilePicture}
                    alt="Profile"
                    className={styles.modalImage}
                    onClick={handleModalImageClick} // Prevent closing when clicking the image
                />
            </div>
        </div>
    )}
  </div>
  );
}

export default ProfilePage;
