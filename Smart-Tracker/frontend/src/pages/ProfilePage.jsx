import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import styles from './ProfilePage.module.css';
import { FaEdit, FaPen } from 'react-icons/fa';
import axios from 'axios'; // Import axios
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
  const [error, setError] = useState(null); // General page load error

  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [isSubmittingName, setIsSubmittingName] = useState(false);

  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [isSubmittingEmail, setIsSubmittingEmail] = useState(false); // For checking availability and sending OTP
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false); // For verifying OTP and updating email

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

        const profileResponse = await axios.get('/api/users/me', { // Using axios
          headers: { 'Authorization': `Bearer ${token}` },
        });
        const profileData = profileResponse.data; // Axios provides data directly
        setUserProfile(profileData);
        setNewName(profileData.name || '');
        setProfilePicture(profileData.profilePicture || null);

        const savingsResponse = await axios.get('/api/transactions/savings/monthly', { // Using axios
             headers: { 'Authorization': `Bearer ${token}` },
        });
        const fetchedMonthlySavings = savingsResponse.data;
        setMonthlySavingsData(fetchedMonthlySavings || []);

        const calculatedTotalSavings = (fetchedMonthlySavings || []).reduce((sum, monthData) => sum + (monthData.savings || 0), 0);
        setTotalSavings(calculatedTotalSavings);

      } catch (err) {
        console.error("Error fetching profile or savings data:", err.response?.data || err.message);
        const message = err.response?.data?.message || err.message || "Failed to load profile data.";
        toast.error(message);
        setError(message);
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
    if (newName.trim() === userProfile?.name) {
        toast.info("Name is unchanged.");
        setIsEditingName(false);
        return;
    }
    setIsSubmittingName(true);
    try {
      const token = localStorage.getItem('authToken');
      const response = await axios.put('/api/users/me/name',
        { name: newName.trim() },
        { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`} }
      );
      setUserProfile(response.data);
      setIsEditingName(false);
      toast.success("Name updated successfully!");
    } catch (err) {
      console.error("Error updating name:", err.response?.data || err.message);
      toast.error(err.response?.data?.message || err.message || 'Failed to update name');
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

  const handleSendOtpForEmailUpdate = async () => {
    if (!newEmail) {
        toast.error("Please enter the new email address first.");
        return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
        toast.error("Please enter a valid email address.");
        return;
    }
    if (newEmail.toLowerCase() === userProfile?.email.toLowerCase()) {
        toast.info("This is already your current email address.");
        return;
    }

    setIsSubmittingEmail(true);
    // setError(''); // Clear local component error if you have one
    try {
      // Step 1: Check if the new email is already taken by ANY user
      // IMPORTANT: Replace with your actual backend URL if needed
      const availabilityRes = await axios.post('http://localhost:5000/api/auth/check-availability', { email: newEmail });

      if (availabilityRes.data.emailExists) {
        // If newEmail exists in the DB AND it's different from the current user's email (checked above),
        // it's highly likely taken by another account.
        toast.error("This email address is already registered to another account. Please use a different email.");
        setIsSubmittingEmail(false); // Reset loading state
        return; // STOP OTP sending
      }

      // Step 2: If email is available, send OTP
      // IMPORTANT: Replace with your actual backend URL if needed
      await axios.post('http://localhost:5000/api/users/send-otp', { email: newEmail });
      toast.success("OTP sent successfully to the new email! Please check inbox (and spam).");
      setIsOtpSent(true);

    } catch (err) {
      console.error("Error during OTP sending for email update:", err.response?.data || err.message);
      const message = err.response?.data?.message || err.message || 'Failed to process email for OTP. Please try again.';
      toast.error(message);
      setIsOtpSent(false);
    } finally {
      setIsSubmittingEmail(false);
    }
  };

  const handleVerifyOtpAndUpdateEmail = async () => {
    if (!otp.trim() || otp.length !== 6) {
        toast.error("Please enter a valid 6-digit OTP.");
        return;
    }
    setIsVerifyingOtp(true);
    try {
      const token = localStorage.getItem('authToken');
      // IMPORTANT: Replace with your actual backend URL if needed
      const response = await axios.put('http://localhost:5000/api/users/me/update-email',
        { newEmail: newEmail, otp: otp }, // newEmail is the target email
        { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`} }
      );
      setUserProfile(response.data);
      setIsEditingEmail(false);
      setIsOtpSent(false);
      setOtp('');
      setNewEmail('');
      toast.success(response.data.message || "Email updated successfully!"); // Backend includes message
    } catch (err) {
      console.error("Error during email update process:", err.response?.data || err.message);
      const errorMessage = err.response?.data?.message || err.message || "Failed to update email. Please try again.";
      if (!toast.isActive('email-update-error')) {
        toast.error(errorMessage, { toastId: 'email-update-error'});
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
              // IMPORTANT: Replace with your actual backend URL if needed
              const response = await axios.put('http://localhost:5000/api/users/me/profile-picture',
                { profilePicture: base64String },
                { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`} }
              );
              setProfilePicture(response.data.profilePicture);
              setUserProfile(prevProfile => ({...prevProfile, profilePicture: response.data.profilePicture}));
              toast.success("Profile picture updated!");
          } catch (err) {
              console.error("Error uploading profile picture:", err.response?.data || err.message);
              toast.error(err.response?.data?.message || err.message || 'Failed to upload profile picture');
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
        fileInputRef.current.click();
  };

  if (loading && !userProfile) {
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
            <div className={styles.profilePicPlaceholder} onClick={handleEditProfilePicClick} title="Add profile picture">
                <FaPen/> Add
            </div>
          )}
          <input type="file" accept="image/*" onChange={handleProfilePicChange} style={{ display: 'none' }} id="profilePicInput" ref={fileInputRef} disabled={isUploadingProfilePic}/>
          {profilePicture && (
            <button className={styles.editProfilePicButton} onClick={handleEditProfilePicClick} disabled={isUploadingProfilePic} title="Change profile picture">
              <FaEdit />
            </button>
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
                    <button onClick={handleSendOtpForEmailUpdate} className={styles.actionButton} disabled={isSubmittingEmail}>
                      {isSubmittingEmail ? "Checking & Sending..." : "Send OTP"}
                    </button>
                  </div>
                ) : (
                  <div className={styles.editFieldInputAndActions}>
                    <input type="text" placeholder="Enter OTP" value={otp} onChange={(e) => setOtp(e.target.value)} className={styles.editInput} disabled={isVerifyingOtp} maxLength={6}/>
                    <button onClick={handleVerifyOtpAndUpdateEmail} className={styles.actionButton} disabled={isVerifyingOtp}>
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
              <BarChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 30 }}>
                <defs>
                  <linearGradient id="colorSavings" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--chart-bar-fill)" stopOpacity={0.9}/>
                    <stop offset="95%" stopColor="var(--chart-bar-fill)" stopOpacity={0.5}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid-color, #ccc)" />
                <XAxis dataKey="name" stroke="var(--chart-axis-color, #666)" interval={0}/>
                <YAxis stroke="var(--chart-axis-color, #666)" tickFormatter={(value) => `₹${value}`}/>
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
                <Bar dataKey="Savings" fill="url(#colorSavings)" barSize={40} radius={[4, 4, 0, 0]}/>
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