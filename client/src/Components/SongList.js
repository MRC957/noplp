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
