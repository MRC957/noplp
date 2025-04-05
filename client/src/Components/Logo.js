/**
 * Logo Component
 * 
 * Displays the animated logo for the application's intro screen.
 * The logo consists of five different parts that are animated with 
 * different delay times to create a sequential appearance effect.
 * Each part refers to an image defined in the CSS file.
 * 
 * This component doesn't accept any props as it's purely presentational
 * and renders with predefined styling and animation settings.
 * 
 * @returns {JSX.Element} An animated logo container with five logo parts
 */
import React from "react";
import './Logo.css';

export default function Logo() {
    return (
        <div className="logo-container">
            <div className="logo-inner">
                {/* Each logo part has a different animation delay for sequential appearance */}
                <div className="logo part-1" style={{animationDelay: '2.5s'}} ></div>
                <div className="logo part-2" style={{animationDelay: '3s'}} ></div>
                <div className="logo part-3" style={{animationDelay: '3.5s'}} ></div>
                <div className="logo part-4" style={{animationDelay: '4s'}} ></div>
                <div className="logo part-5" style={{animationDelay: '4.5s'}} ></div>
            </div>
        </div>
    );
}
