/**
 * SongList Component
 * 
 * Displays a list of songs under a category title.
 * Each song is rendered in a TextBox showing the title, artist, and year.
 * Songs that have been previously selected (picked) will be displayed with 
 * a disabled style.
 * 
 * @param {Object} props - Component props
 * @param {string} props.title - The title of the category
 * @param {Array} props.songs - Array of song objects to display
 * @param {string} props.songs[].title - The title of each song
 * @param {string} props.songs[].artist - The artist of each song
 * @param {string} props.songs[].year - The release year of each song
 * @param {boolean} props.songs[].picked - Whether the song has been picked/selected
 * @returns {JSX.Element} A category title followed by a list of songs
 */
import React from "react";
import TextBox from "./TextBox";
import './SongList.css';

export default function SongList({ title, songs }) {
    return (
        <>
            <TextBox content={title} className="category-name"></TextBox>
            {songs.map((song, i) => (
                <TextBox disabled={song.picked} key={i}>
                    <div>{song.title}</div>
                    <div className="song-artist">{song.artist}</div>
                    <div className="song-artist">{song.year}</div>
                </TextBox>
            ))}
        </>
    );
}
