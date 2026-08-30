import React from 'react';
import { Colors } from "@blueprintjs/core";

const ProgressBar = ({ value = 0, text, maxValue = 100, progress = {}, row = {} }) => {
    const numericValue = Number(value) || 0;
    let numericMax = Number(maxValue) || 100;
    if (progress.maxValueField) {
        const rowMax = Number(row?.[progress.maxValueField]);
        if (Number.isFinite(rowMax) && rowMax > 0) {
            numericMax = rowMax;
        }
    }
    const widthValue = Math.max(0, Math.min(1, numericMax > 0 ? numericValue / numericMax : 0));
    const remainder = 100 - (100 * widthValue);
    return (
        <div>
            <div
                style={{
                    display: "flex",
                    position: "relative",
                    width: "100%",
                    height: "20px",
                    borderRadius: "4px",
                    overflow: "hidden",
                    boxShadow: "0px 0px 4px rgba(0, 0, 0, 0.2)",
                }}
            >
                <div
                    style={{
                        backgroundColor: Colors.GREEN5,
                        width: `${100 * widthValue}%`,
                        transition: "width 0.3s ease",
                    }}
                ></div>

                <div
                    style={{
                        backgroundColor: Colors.RED5,
                        width: `${remainder}%`,
                        transition: "width 0.3s ease",
                    }}
                ></div>

                <span
                    style={{
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                        color: "white",
                        fontWeight: "bold",
                        fontSize: "12px",
                        pointerEvents: "none",
                    }}
                >
                    {text || `${value}%`}
                </span>
            </div>
        </div>
    );
};

export default ProgressBar;
