import React, { useState } from "react";
import mondaySdk from "monday-sdk-js";
import * as XLSX from "xlsx";

const monday = mondaySdk();

const App = () => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  const handleFileChange = (event) => {
    setFile(event.target.files[0]);
  };

  const fetchItemsFromMonday = async (boardId) => {
    const query = `query {
      boards(ids: [${boardId}]) {
        items_page(limit: 500) {
          items {
            name
            id
          }
        }
      }
    }`;

    try {
      const res = await monday.api(query);
      const items = res?.data?.boards[0]?.items_page?.items || [];
      return Object.fromEntries(items.map((item) => [item.name.trim(), item.id]));
    } catch (error) {
      console.error("Error fetching items:", error);
      return {};
    }
  };

  const addCommentToTask = async (itemId, comment) => {
    const mutation = `mutation {
      create_update(item_id: ${itemId}, body: "${comment.replace(/"/g, '\\"')}") {
        id
      }
    }`;

    try {
      await monday.api(mutation);
      return true;
    } catch (error) {
      console.error(`Error adding comment to ${itemId}:`, error);
      return false;
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setMessage("Please select a file.");
      return;
    }

    setUploading(true);
    setMessage("Processing file...");

    const reader = new FileReader();
    reader.onload = async (e) => {
      const workbook = XLSX.read(e.target.result, { type: "binary" });
      const sheetName = workbook.SheetNames[0];
      const sheet = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

      if (!sheet.length || !sheet[0].Task || !sheet[0].Comment) {
        setMessage("Invalid file format. Ensure columns are 'Task' and 'Comment'.");
        setUploading(false);
        return;
      }

      try {
        const boardContext = await monday.get("context");
        const boardId = boardContext.data.boardId;
        const itemsMap = await fetchItemsFromMonday(boardId);

        let successCount = 0;
        for (const row of sheet) {
          const taskName = row.Task.trim();
          const comment = row.Comment.trim();
          const itemId = itemsMap[taskName];

          if (itemId && await addCommentToTask(itemId, comment)) {
            successCount++;
          }
        }

        setMessage(`✅ Successfully added comments to ${successCount} tasks.`);
      } catch (error) {
        setMessage("❌ Error processing file.");
        console.error(error);
      }

      setUploading(false);
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div style={{ padding: "20px", fontFamily: "Arial" }}>
      <h2>Upload Excel File</h2>
      <input type="file" accept=".xlsx" onChange={handleFileChange} />
      <button onClick={handleUpload} disabled={uploading}>
        {uploading ? "Processing..." : "Upload & Process"}
      </button>
      <p>{message}</p>
    </div>
  );
};

export default App;
