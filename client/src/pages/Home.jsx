import React from 'react'
import { useNavigate } from 'react-router-dom'
import '../home.css'

export default function Home() {
  const navigate = useNavigate()
  const leftLogo = '/MKCE LOGO.png'
  const rightLogos = ['/25 Years logo.png', '/naac logo.png', '/kr logo.png']

  const handleLoginClick = (role) => {
    navigate('/login', { state: { role } })
  }

  return (
    <div className="container">
      <div className="top-left-logo">
        <img
          src={leftLogo}
          alt="College Logo Left"
          className="corner-logo left-corner-logo"
        />
      </div>

      <div className="top-right-logos">
        {rightLogos.map((logoSrc, index) => (
          <img
            key={`${logoSrc}-${index}`}
            src={logoSrc}
            alt={`College Logo Right ${index + 1}`}
            className="corner-logo"
          />
        ))}
      </div>
      <div className="content">
        <h1 className="title">Academic Resource Hub</h1>
        <p className="subtitle">Empowering Education Through Technology</p>
        <div className="buttons-container">
          <button 
            className="login-btn admin-btn" 
            onClick={() => handleLoginClick('admin')}
          >
            <span className="btn-icon">👨‍💼</span>
            <span className="btn-text">Admin</span>
          </button>
          <button 
            className="login-btn faculty-btn" 
            onClick={() => handleLoginClick('faculty')}
          >
            <span className="btn-icon">👨‍🏫</span>
            <span className="btn-text">Faculty</span>
          </button>
          <button 
            className="login-btn student-btn" 
            onClick={() => handleLoginClick('student')}
          >
            <span className="btn-icon">👨‍🎓</span>
            <span className="btn-text">Student</span>
          </button>
        </div>
      </div>
    </div>
  )
}
