/**
 * Background Component
 * 
 * Creates animated visual effects for the application background including:
 * - Moving spotlights that simulate a stage lighting environment
 * - Snowflake animations for special effects
 * - Flash effects triggered by game events
 * 
 * The component supports a "performance mode" that renders a simplified static
 * background to reduce CPU usage on slower devices.
 * 
 * @param {Object} props - Component props
 * @param {string} props.effect - Name of the effect to display (e.g., 'good', 'bad')
 * @param {boolean} props.perfMode - Whether to use performance mode (static background)
 * @returns {JSX.Element} An animated background with spotlights and effects
 */
import React from "react";

import './Background.scss'

export default class Background extends React.Component {
    constructor(props) {
        super(props);
        // Configuration for spotlight elements
        // x: horizontal position, d: delay, r: rotation angle
        // o: opacity, t: animation duration
        this.spots = [
            {x: '3%', d: '150ms', r: -20, o: 0.5, t: '4.5s'},
            {x: '20%', d: '300ms', r: 5, o: 1, t: '3.1s'},
            {x: '30%', d: '400ms', r: -0, o: 1, t: '3.6s'},
            {x: '47%', d: '600ms', r: -0, o: 1, t: '3.8s'},
            {x: '52%', d: '500ms', r: -20, o: 1, t: '4.2s'},
            {x: '67%', d: '300ms', r: -0, o: 1, t: '3.1s'},
            {x: '77%', d: '200ms', r: -5, o: 1, t: '4s'},
            {x: '92%', d: '150ms', r: 0, o: 0.5, t: '4s'}, 
        ]

        // Generate snowflake elements
        this.flakes = [];
        for (let i = 0; i < 40; ++i) {
            this.flakes.push({});
        }

        this.state = {
            effect: '', // Current visual effect being displayed
        };
    }

    /**
     * Detect changes to the effect prop and apply the new effect
     * This uses a trick where we first clear the effect and then set it 
     * in a callback to ensure CSS transitions trigger correctly
     * 
     * @param {Object} prevProps - Previous component props
     */
    componentDidUpdate(prevProps) {
        if (prevProps.effect !== this.props.effect) {
            // Define function to apply the effect
            const apply = ((c) => {
                console.log(' Applying', c)
                this.setState({
                    ...this.state,
                    effect: c,
                });
            });
           
            // First clear the current effect, then apply the new one
            this.setState({
                ...this.state,
                effect: '',
            }, () => {apply(this.props.effect)});
        }
    }

    render() {
        // In performance mode, return a simple static background
        if (this.props.perfMode) {
            return (
                <div className="background static-background">
                </div>
            )
        }

        // Normal mode with animated elements
        return (
            <div className={`background ${this.state.effect}`}>
                {/* Render spotlight elements */}
                { this.spots.map((s, i) => {
                    return (
                        <div 
                            key={`spot-${i}`} 
                            className="spotlight-container" 
                            style={{
                                left: s.x,
                                opacity: s.o,
                                transform: `rotate(${s.r}deg)`
                            }}
                        > 
                            <div  
                                className="spotlight" 
                                src="spotlight.png" 
                                style={{
                                    animationDelay: s.d, 
                                    animationDuration: s.t
                                }}
                            ></div>
                        </div>
                    )
                }) }
    
                {/* Render snowflake elements */}
                { this.flakes.map((f, i) => {
                    return (
                        <div className="snowflake" key={`flake-${i}`}></div>
                    )
                }) }
            </div>
        )
    }
}
