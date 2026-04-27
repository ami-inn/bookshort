'use server';
import { connectToDatabase } from "@/database/mongoose";
import { CreateBook, TextSegment } from "@/types";
import { escapeRegex, generateSlug, serializeData } from "../utils";
import Book from "@/database/models/book.model";
import BookSegment from "@/database/models/book-segment.model";
import mongoose from "mongoose";
import { revalidatePath } from "next/cache";

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

    revalidatePath("/"); // revalidate homepage to show the new book

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


export const getAllBooks = async (search?: string) => {
    try {
        await connectToDatabase();

        let query = {};

        if (search) {
            const escapedSearch = escapeRegex(search);
            const regex = new RegExp(escapedSearch, 'i');
            query = {
                $or: [
                    { title: { $regex: regex } },
                    { author: { $regex: regex } },
                ]
            };
        }

        const books = await Book.find(query).sort({ createdAt: -1 }).lean();

        return {
            success: true,
            data: serializeData(books)
        }
    } catch (e) {
        console.error('Error connecting to database', e);
        return {
            success: false, error: e
        }
    }
}


export const getBookBySlug = async (slug: string) => {
    try {
        await connectToDatabase();

        const book = await Book.findOne({ slug }).lean();

        if (!book) {
            return { success: false, error: 'Book not found' };
        }

        return {
            success: true,
            data: serializeData(book)
        }
    } catch (e) {
        console.error('Error fetching book by slug', e);
        return {
            success: false, error: e
        }
    }
}



// Searches book segments using MongoDB text search with regex fallback
export const searchBookSegments = async (bookId: string, query: string, limit: number = 5) => {
    try {
        await connectToDatabase();

        console.log(`Searching for: "${query}" in book ${bookId}`);

        const bookObjectId = new mongoose.Types.ObjectId(bookId);

        // Try MongoDB text search first (requires text index)
        let segments: Record<string, unknown>[] = [];
        try {
            segments = await BookSegment.find({
                bookId: bookObjectId,
                $text: { $search: query },
            })
                .select('_id bookId content segmentIndex pageNumber wordCount')
                .sort({ score: { $meta: 'textScore' } })
                .limit(limit)
                .lean();
        } catch {
            // Text index may not exist — fall through to regex fallback
            segments = [];
        }

        // Fallback: regex search matching ANY keyword
        if (segments.length === 0) {
            const keywords = query.split(/\s+/).filter((k) => k.length > 2);
            const pattern = keywords.map(escapeRegex).join('|');

            segments = await BookSegment.find({
                bookId: bookObjectId,
                content: { $regex: pattern, $options: 'i' },
            })
                .select('_id bookId content segmentIndex pageNumber wordCount')
                .sort({ segmentIndex: 1 })
                .limit(limit)
                .lean();
        }

        console.log(`Search complete. Found ${segments.length} results`);

        return {
            success: true,
            data: serializeData(segments),
        };
    } catch (error) {
        console.error('Error searching segments:', error);
        return {
            success: false,
            error: (error as Error).message,
            data: [],
        };
    }
};