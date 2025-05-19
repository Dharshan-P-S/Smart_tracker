import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import styles from './ProfilePage.module.css'; // Ensure this path is correct
import { FaEdit, FaPen } from 'react-icons/fa';
// Import BarChart components from recharts
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';

function ProfilePage() {
  const [userProfile, setUserProfile] = useState(null);
  const [totalSavings, setTotalSavings] = useState(0);
  const [monthlySavingsData, setMonthlySavingsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [isSubmittingName, setIsSubmittingName] = useState(false);

  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [isSubmittingEmail, setIsSubmittingEmail] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);

  const [profilePicture, setProfilePicture] = useState(null);
  const [isUploadingProfilePic, setIsUploadingProfilePic] = useState(false);
  const fileInputRef = useRef(null);

  const [isModalOpen, setIsModalOpen] = useState(false);

  const openModal = () => { if (profilePicture) setIsModalOpen(true); };
  const closeModal = () => setIsModalOpen(false);
  const handleModalImageClick = (e) => e.stopPropagation();

  useEffect(() => {
    const fetchProfileData = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem('authToken');
        if (!token) {
          toast.error("Authentication token not found. Please log in.");
          setLoading(false);
          return;
        }

        const profileResponse = await fetch('/api/users/me', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!profileResponse.ok) {
          let errorData = { message: `Error ${profileResponse.status}: ${profileResponse.statusText}`};
          try { errorData = await profileResponse.json(); } catch (e) { /* ignore */ }
          throw new Error(errorData.message || `Failed to fetch profile data`);
        }
        const profileData = await profileResponse.json();
        setUserProfile(profileData);
        setNewName(profileData.name || '');
        setProfilePicture(profileData.profilePicture || null);

        const savingsResponse = await fetch('/api/transactions/savings/monthly', {
             headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!savingsResponse.ok) {
            let errorData = { message: `Error ${savingsResponse.status}: ${savingsResponse.statusText}`};
            try { errorData = await savingsResponse.json(); } catch (e) { /* ignore */ }
             throw new Error(errorData.message || `Failed to fetch monthly savings data`);
        }
        const fetchedMonthlySavings = await savingsResponse.json();
        setMonthlySavingsData(fetchedMonthlySavings || []);

        const calculatedTotalSavings = (fetchedMonthlySavings || []).reduce((sum, monthData) => sum + (monthData.savings || 0), 0);
        setTotalSavings(calculatedTotalSavings);

      } catch (err) {
        console.error("Error fetching profile or savings data:", err);
        toast.error(`Failed to load data: ${err.message}`);
        setError(`Failed to load data: ${err.message}`);
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
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`},
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
    setNewName(userProfile?.name || '');
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
        toast.success("OTP sent successfully! Please check your inbox (and spam folder).");
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
    if (!otp.trim() || otp.length !== 6) {
        toast.error("Please enter a valid 6-digit OTP.");
        return;
    }
    setIsVerifyingOtp(true);
    try {
      const token = localStorage.getItem('authToken');
      const updateEmailResponse = await fetch('/api/users/me/update-email', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`},
        body: JSON.stringify({ newEmail: newEmail, otp: otp }),
      });
      if (!updateEmailResponse.ok) {
        let errorData = { message: `Error ${updateEmailResponse.status}: ${updateEmailResponse.statusText}`};
        try { errorData = await updateEmailResponse.json(); } catch (e) { /* ignore */ }
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
        toast.error( { toastId: 'error-toast'});
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
      if (!file.type.startsWith('image/')) {
          toast.error("Please select an image file (e.g., JPG, PNG).");
          return;
      }
      if (file.size > 2 * 1024 * 1024) {
          toast.error("Image size should be less than 2MB.");
          return;
      }
      setIsUploadingProfilePic(true);
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onloadend = async () => {
          const base64String = reader.result;
          try {
              const token = localStorage.getItem('authToken');
              const response = await fetch('/api/users/me/profile-picture', {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`},
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
    return <div className={styles.profileContainer}><p className={styles.loadingText}>Loading profile data...</p></div>;
  }

  if (error && !userProfile) {
    return <div className={styles.profileContainer}><p className={styles.error}>{error}</p></div>;
  }

  if (!userProfile) {
      return <div className={styles.profileContainer}><p>User profile not found. Please try logging in again.</p></div>;
  }

  const chartData = (monthlySavingsData || []).map(item => ({
    name: new Date(item.month).toLocaleString('default', { month: 'short', year: 'numeric' }),
    Savings: parseFloat((item.savings || 0).toFixed(2)),
  })).sort((a, b) => {
    const dateA = new Date(a.name.replace(/(\w{3})\s(\d{4})/, '$1 1, $2'));
    const dateB = new Date(b.name.replace(/(\w{3})\s(\d{4})/, '$1 1, $2'));
    return dateA - dateB;
  });

  return (
    <div className={styles.profileContainer}>
      <h1 className={styles.pageTitle}>User Profile</h1>

      <section className={styles.profileSection}>
        <div className={styles.profilePicContainer}>
          {profilePicture ? (
            <img src={profilePicture} alt="Profile" className={styles.profilePic} onClick={openModal}/>
          ) : (
            <div className={styles.profilePicPlaceholder}>No Picture</div>
          )}
          <input type="file" accept="image/*" onChange={handleProfilePicChange} style={{ display: 'none' }} id="profilePicInput" ref={fileInputRef} disabled={isUploadingProfilePic}/>
          {profilePicture && (
            <button className={styles.editProfilePicButton} onClick={handleEditProfilePicClick} disabled={isUploadingProfilePic} title="Change profile picture">
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
          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>Name:</span>
            {isEditingName ? (
              <div className={styles.editFieldContainer}>
                <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} className={styles.editInput} disabled={isSubmittingName} placeholder="Enter your name"/>
                <div className={styles.actionButtonsContainer}>
                  <button onClick={handleSaveName} className={styles.saveButton} disabled={isSubmittingName}>
                    {isSubmittingName ? "Saving..." : "Save"}
                  </button>
                  <button onClick={handleCancelEditName} className={styles.cancelButton} disabled={isSubmittingName}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <span className={styles.detailValue}>{userProfile.name || 'N/A'}</span>
                <button onClick={handleEditName} className={styles.editButtonInline} title="Edit name"><FaPen /></button>
              </>
            )}
          </div>

          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>Email:</span>
            {isEditingEmail ? (
              <div className={styles.editFieldContainer}>
                {!isOtpSent ? (
                  <div className={styles.editFieldInputAndActions}>
                    <input type="email" placeholder="Enter new email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className={styles.editInput} disabled={isSubmittingEmail}/>
                    <button onClick={handleSendOtp} className={styles.actionButton} disabled={isSubmittingEmail}>
                      {isSubmittingEmail ? "Sending..." : "Send OTP"}
                    </button>
                  </div>
                ) : (
                  <div className={styles.editFieldInputAndActions}>
                    <input type="text" placeholder="Enter OTP" value={otp} onChange={(e) => setOtp(e.target.value)} className={styles.editInput} disabled={isVerifyingOtp} maxLength={6}/>
                    <button onClick={handleVerifyOtp} className={styles.actionButton} disabled={isVerifyingOtp}>
                      {isVerifyingOtp ? "Verifying..." : "Verify & Update"}
                    </button>
                  </div>
                )}
                <div className={styles.actionButtonsContainer} style={{ justifyContent: 'flex-end' }}>
                  <button onClick={handleCancelEditEmail} className={styles.cancelButton} disabled={isSubmittingEmail || isVerifyingOtp}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <span className={styles.detailValue}>{userProfile.email || 'N/A'}</span>
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

      <section className={`${styles.profileSection} ${styles.chartLayoutOverride}`}>
        <h2 className={styles.sectionTitle}>Monthly Savings Trend</h2>
        {monthlySavingsData && monthlySavingsData.length > 0 ? (
          <div className={styles.chartContainer}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={chartData}
                margin={{ top: 5, right: 30, left: 0, bottom: 30 }} // Increased bottom margin for labels
                // barCategoryGap="20%" // Optional: Adjust gap between category bands
              >
                <defs>
                  <linearGradient id="colorSavings" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--chart-bar-fill)" stopOpacity={0.9}/>
                    <stop offset="95%" stopColor="var(--chart-bar-fill)" stopOpacity={0.5}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid-color, #ccc)" />
                <XAxis
                  dataKey="name"
                  stroke="var(--chart-axis-color, #666)"
                  interval={0} // Show all labels; use "preserveStartEnd" if they overlap
                  // textAnchor="middle" // Default for horizontal, usually not needed
                  // dy={5} // Optional: small vertical offset for labels if needed
                  // tick={{ fontSize: 11 }} // Optional: reduce font size if labels are long
                />
                <YAxis
                  stroke="var(--chart-axis-color, #666)"
                  tickFormatter={(value) => `₹${value}`}
                  // domain={['auto', 'auto']} // Or specify a domain like [0, 'dataMax + 100']
                  // allowDataOverflow={true}
                />
                <Tooltip
                    contentStyle={{
                        backgroundColor: 'var(--tooltip-bg, #fff)',
                        borderColor: 'var(--tooltip-border, #ccc)',
                        color: 'var(--tooltip-text, #333)',
                        borderRadius: '4px',
                        boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
                    }}
                    formatter={(value, name) => [`₹${value.toFixed(2)}`, name]}
                    cursor={{ fill: 'rgba(204,204,204,0.2)' }}
                />
                <Legend wrapperStyle={{ color: 'var(--chart-legend-color, #333)', paddingTop: '10px'}}/>
                <Bar
                  dataKey="Savings"
                  fill="url(#colorSavings)"
                  barSize={40}
                  // barSize={40} // Option 1: Fixed bar size (Recharts centers this in the band)
                  // maxBarSize={50} // Option 2: Responsive with a cap
                                    // Option 3: No barSize or maxBarSize (Recharts calculates width, usually best for centering)
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className={styles.noDataText}>No monthly savings data available to display chart.</p>
        )}
      </section>

      {isModalOpen && (
        <div className={styles.modalOverlay} onClick={closeModal}>
            <div className={styles.modalContent} onClick={handleModalImageClick}>
                <img src={profilePicture} alt="Profile (Full screen)" className={styles.modalImage}/>
            </div>
        </div>
      )}
    </div>
  );
}

export default ProfilePage;