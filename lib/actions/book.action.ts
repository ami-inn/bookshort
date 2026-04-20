'use server';
import { connectToDatabase } from "@/database/mongoose";
import { CreateBook, TextSegment } from "@/types";
import { generateSlug, serializeData } from "../utils";
import Book from "@/database/models/book.model";
import BookSegment from "@/database/models/book-segment.model";

export const createBook = async (data: CreateBook) => {
  try {
    await connectToDatabase();

    // generate book slug from title and author
    const slug = generateSlug(data.title);

    const existingBook = await Book.findOne({ slug }).lean(); // lean for faster query since we don't need mongoose document methods

    if (existingBook) {
      return {
        success: true,
        data: serializeData(existingBook),
        alreadyExists: true,
      };
    }

    // check the subscription limit before creating a new book
    // todo

    const book = await Book.create({
      ...data,
      slug,
      totalSegments: 0, // initialize totalSegments to 0, will update after processing PDF
    });

    return { success: true, data: serializeData(book) };
  } catch (error) {
    console.error("Error creating book:", error);
    return { success: false, error: "Failed to create book" };
  }
};

// the use of segments is to store the content of the book in smaller chunks. this is because when we read the book using vapi we can read the specific segment of the book instead of loading the entire book into memory. this will improve the performance and reduce the memory usage of our application. also it will allow us to implement features like reading by page number or segment index. instead of loading entire book we can load the specific segment of book.
export const saveBookSegment = async (
  bookId: string,
  clerkId: string,
  segments: TextSegment[],
) => {
  try {
    await connectToDatabase();

    console.log("saving book segments");

    const segmentsToInsert = segments.map((segment) => ({
      clerkId,
      bookId,
      content: segment.text,
      segmentIndex: segment.segmentIndex,
      pageNumber: segment.pageNumber,
      wordCount: segment.wordCount,
    }));
    await BookSegment.insertMany(segmentsToInsert);
    // we are not saving the books we are extracting the content of the book and saving it in the book segment collection. this is because when we read the book using vapi we can read the specific segment of the book instead of loading the entire book into memory. this will improve the performance and reduce the memory usage of our application. also it will allow us to implement features like reading by page number or segment index. instead of loading entire book we can load the specific segment of book.
    // update totalSegments in book document
    await Book.findByIdAndUpdate(bookId, { totalSegments: segments.length });

    console.log("book segments saved successfully");

    return {
      success: true,
      data: {
        segementsCreated: segments.length,
      },
    };
  } catch (error) {
    console.error("Error saving book segment:", error);
    await BookSegment.deleteMany({ bookId }); // rollback any segments that were saved for this book
    await Book.findByIdAndDelete(bookId); // delete the book record as well since it's incomplete without segments
    console.log("Rolled back book and segments due to error:", error);
    return { success: false, error: "Failed to save book segment" };
  }
};

export const checkBookExists = async (title: string) => {
  try {
    await connectToDatabase();
    const slug = generateSlug(title);

    const existingBook = await Book.findOne({ slug }).lean();

    if (existingBook) {
      return {
        exists: true,
        data: serializeData(existingBook),
      };
    }
    return {
      exists: false,
    };
  } catch (error) {
    console.error("Error checking book existence:", error);
    return {
      exists: false,
      error: 0,
    };
  }
};
