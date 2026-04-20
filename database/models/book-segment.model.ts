import { model, Schema, models, Types } from "mongoose";
import { IBookSegment } from "@/types";

// booksemnet use for once we upload pdf we splitit into additional chunks

const BookSegmentSchema = new Schema<IBookSegment>({
    clerkId: { type: String, required: true },
    bookId: { type: Schema.Types.ObjectId, ref: 'Book', required: true, index: true }, //index for faster queries by bookId
    content: { type: String, required: true },
    segmentIndex: { type: Number, required: true, index: true },
    pageNumber: { type: Number, index: true, },
    wordCount: { type: Number, required: true },
}, { timestamps: true });

BookSegmentSchema.index({ bookId: 1, segmentIndex: 1 }, { unique: true }); // Ensure unique segmentIndex for each bookId combination. 
BookSegmentSchema.index({ bookId: 1, pageNumber: 1 }); // Add a text index on content for full-text search capabilities within segments of a book.

BookSegmentSchema.index({ bookId: 1, content: 'text' });

// when vapi read book allowed. this lookup will be faster to find the content of book by page number or segment index. instead of loading entire book we can load the specific segment of book.

const BookSegment = models.BookSegment || model<IBookSegment>('BookSegment', BookSegmentSchema);

export default BookSegment;