import { DocumentToolbar } from "@powerhousedao/design-system/connect";
import { useSelectedExpenseReportDocument } from "document-models/expense-report";
import { ExpenseDetail } from "../sektar/components/ExpenseDetail.js";
import { Sprite } from "../sektar/kit/ui.js";

/** An expense claim as a document: Connect's toolbar on top, the Sektar detail view below. */
export default function Editor() {
  const [document] = useSelectedExpenseReportDocument();
  return (
    <>
      {/* Connect's toolbar keeps Connect's styling; the Sektar styles start below it. */}
      <DocumentToolbar />
      <div
        className="sk-app sk-page"
        style={{ minHeight: "100%", background: "transparent" }}
      >
        <Sprite />
        <div
          className="sk-container sk-stack sk-stack--6"
          style={{ maxWidth: 960, paddingBlock: "var(--sk-space-6)" }}
        >
          <div className="sk-card">
            <ExpenseDetail doc={document} />
          </div>
        </div>
      </div>
    </>
  );
}
