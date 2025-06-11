import React, { useState, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { addTask } from "../store/taskSlice";
import type { AppDispatch, RootState } from "../store/store";
import { useSnackbar } from "notistack";
import { motion } from "framer-motion";
import { ClipLoader } from "react-spinners";
import "./UploadJson.css";

type Status = "todo" | "inprogress" | "review" | "completed";
type Priority = "low" | "medium" | "high";

const UploadJson: React.FC = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [fileName, setFileName] = useState("");

  const dispatch = useDispatch<AppDispatch>();
  const theme = useSelector((state: RootState) => state.theme);
  const { enqueueSnackbar } = useSnackbar();

  const [parsedTasks, setParsedTasks] = useState<any[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (!Array.isArray(json)) {
          enqueueSnackbar("Invalid JSON: Expected an array of tasks.", {
            variant: "error",
          });
          resetFileInput();
          return;
        }

        if (json.length === 0) {
          enqueueSnackbar("JSON file is empty.", { variant: "error" });
          resetFileInput();
          return;
        }

        setParsedTasks(json);
        enqueueSnackbar(
          "File parsed successfully. Click 'Upload' to continue.",
          {
            variant: "info",
          }
        );
      } catch (err: any) {
        enqueueSnackbar(`Failed to parse JSON: ${err.message}`, {
          variant: "error",
        });
        resetFileInput();
      }
    };

    reader.readAsText(file);
  };

  const resetFileInput = () => {
    if (fileInputRef.current) fileInputRef.current.value = "";
    setParsedTasks(null);
    setFileName("");
  };

  // date format validator
  const isValidDateFormat = (dateStr: string) => {
    return /^\d{2}-\d{2}-\d{4}$/.test(dateStr);
  };

  // converting DD-MM-YYYY → YYYY-MM-DD
  const convertToISO = (dateStr: string) => {
    const [dd, mm, yyyy] = dateStr.split("-");
    return `${yyyy}-${mm}-${dd}`;
  };

  const handleUpload = () => {
    if (!parsedTasks || parsedTasks.length === 0) {
      enqueueSnackbar("No valid data to upload.", { variant: "error" });
      return;
    }
    setIsUploading(true);
    let successCount = 0;
    let totalCount = parsedTasks.length;

    parsedTasks.forEach((task) => {
      const { title, description, status, priority, assignee, due_date } = task;

      const isValid =
        typeof title === "string" &&
        typeof description === "string" &&
        typeof status === "string" &&
        typeof priority === "string" &&
        typeof assignee === "string" &&
        (due_date === undefined || isValidDateFormat(due_date));

      if (isValid) {
        dispatch(
          addTask({
            title,
            description,
            due_date: due_date ? convertToISO(due_date) : null,
            status: status as Status,
            assignee,
            priority: priority as Priority,
          })
        );

        successCount++;
      }
    });

    if (successCount === 0) {
      enqueueSnackbar("None of the tasks were valid. Nothing was imported.", {
        variant: "error",
      });
    } else if (successCount < totalCount) {
      enqueueSnackbar(
        `${successCount} out of ${totalCount} tasks were imported. ${
          totalCount - successCount
        } tasks are not following the format`,
        { variant: "warning" }
      );
    } else {
      enqueueSnackbar(`Successfully imported ${successCount} tasks.`, {
        variant: "success",
      });
    }
    setIsUploading(false);
    resetFileInput();
  };

  return (
    <div className="upload-json-container">
      <motion.div
        className="upload-pane"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        style={{
          backgroundColor: theme === "dark" ? "gray" : "#f8f9fa",
        }}
      >
        <h3>📥 Import Tasks</h3>
        <button
          className="choose-file-button"
          onClick={() => fileInputRef.current?.click()}
        >
          Choose JSON File
        </button>
        <input
          type="file"
          accept=".json"
          onChange={handleFileSelection}
          ref={fileInputRef}
          style={{ display: "none" }}
        />
        <button className="upload-button" onClick={handleUpload}>
          {isUploading ? (
            <>
              <ClipLoader size={16} color="#36d7b7" />
              <span style={{ marginLeft: "8px" }}>Uploading...</span>
            </>
          ) : (
            "Upload"
          )}
        </button>
        {fileName && (
          <p style={{ marginTop: "8px" }}>
            Selected file: <strong>{fileName}</strong>
          </p>
        )}
      </motion.div>

      <motion.div
        className="instructions-pane"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
        style={{
          backgroundColor: theme === "dark" ? "gray" : "#f8f9fa",
        }}
      >
        <h3>📝 Instructions</h3>
        <ul>
          <li>
            Upload a valid `.json` file containing an array of task objects.
          </li>
          <li>
            Each task must have:
            <ul>
              <li>
                <code>title</code> (string)
              </li>
              <li>
                <code>description</code> (string)
              </li>
              <li>
                <code>status</code>: "todo" | "inprogress" | "review" |
                "completed"
              </li>
              <li>
                <code>priority</code>: "low" | "medium" | "high"
              </li>
              <li>
                <code>assignee</code> (string)
              </li>
              <li>
                <code>due_date</code> (optional, string in{" "}
                <strong>DD-MM-YYYY</strong> format)
              </li>
            </ul>
          </li>
        </ul>
        <p>Example:</p>
        <pre
          style={{
            backgroundColor: theme === "dark" ? "#2d2d2d" : "#fff",
            color: theme === "dark" ? "#f1f1f1" : "#000",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {`[
  {
    "title": "Sample Task",
    "description": "Complete the sample task with mentioned tools",
    "status": "todo",
    "priority": "medium",
    "assignee": "Robin",
    "due_date": "30-06-2025"
  }
]`}
        </pre>
      </motion.div>
    </div>
  );
};

export default UploadJson;
