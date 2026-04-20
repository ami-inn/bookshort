"use client";

import React from "react";
import { useForm } from "react-hook-form";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./ui/form";
import FileUploader from "./FileUploader";
import { Upload, ImageIcon } from "lucide-react";
import { BookUploadFormValues } from "@/types";
import { UploadSchema } from "@/lib/zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ACCEPTED_IMAGE_TYPES, ACCEPTED_PDF_TYPES } from "@/lib/constants";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import VoiceSelector from "./VoiceSelector";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { checkBookExists, createBook } from "@/lib/actions/book.action";
import { useRouter } from "next/navigation";
import { parsePDFFile } from "@/lib/utils";
import { upload } from "@vercel/blob/client";

const UploadForm = () => {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const form = useForm<BookUploadFormValues>({
    resolver: zodResolver(UploadSchema),
    defaultValues: {
      title: "",
      author: "",
      persona: "",
      pdfFile: undefined,
      coverImage: undefined,
    },
  });

  const { userId } = useAuth();
  const router = useRouter();

  const onSubmit = async (data: BookUploadFormValues) => {
    console.log("Form Data:", data);

    if (!userId) {
      return toast.error("You must be logged in to upload a book.");
    }

    setIsSubmitting(true);

    try {
      const existCheck = await checkBookExists(data.title);

      if (existCheck.exists && existCheck.data) {
        toast.error(
          `A book with the title "${data.title}" already exists. Please choose a different title.`,
        );
        form.reset();
        router.push(`/books/${existCheck.data.slug}`);
      }

      const fileTitle = data.title.replace(/\s+/g, "_").toLowerCase();
      const pdfFile = data.pdfFile;
      const parsedPDF = await parsePDFFile(pdfFile);

      if (parsedPDF.content.length === 0) {
        return toast.error(
          "Failed to parse PDF content. Please try again with a different file.",
        );
      }

      const uploadedPdfBlob = await upload(fileTitle, pdfFile, {
        access: "public", // Set the access level to public so we can access the file via URL
        handleUploadUrl: "/api/upload",
        contentType: "application/pdf",
      });

      let coverUrl: string;
      if (data.coverImage) {
        const coverFile = data.coverImage;
        const uploadedCoverBlob = await upload(
          `${fileTitle}_cover.png`,
          coverFile,
          {
            access: "public",
            handleUploadUrl: "/api/upload",
            contentType: coverFile.type,
          },
        );
        coverUrl = uploadedCoverBlob.url;
      } else {
        // if user didnt give the cover image we will use the first page of pdf as cover image. we already have the data url of cover image in parsedPDF.cover. we need to convert this data url to blob and then upload it to vercel blob storage to get the url of cover image.
        const response = await fetch(parsedPDF.cover);
        const blob = await response.blob();

        const uploadedCoverBlob = await upload(`${fileTitle}_cover.png`, blob, {
          access: "public",
          handleUploadUrl: "/api/upload",
          contentType: "image/png",
        });
        coverUrl = uploadedCoverBlob.url;
      }

      const book = await createBook({
        clerkId: userId,
        title: data.title,
        author: data.author,
        persona: data.persona, // persona is the voice of assistant that user can choose. we will use this persona to generate the response of assistant in the future. for now we are just saving it in the book document.
        fileURL: uploadedPdfBlob.url,
        fileBlobKey: uploadedPdfBlob.pathname,
        coverURL: coverUrl,
        fileSize: pdfFile.size,
      });

      if (!book.success) {
        toast.error((book.error as string) || "Failed to create book");
        // if (book.isBillingError) {
        //   router.push("/subscriptions");
        // }
        return;
      }
    } catch (error) {
      console.error("Error uploading book:", error);
      toast.error("Failed to upload book.");
    } finally {
      setIsSubmitting(false);
    }
  };
  return (
    <>
      <div className="new-book-wrapper">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <FileUploader
              control={form.control}
              name="pdfFile"
              label="Book PDF File"
              acceptTypes={ACCEPTED_PDF_TYPES}
              icon={Upload}
              placeholder="Click to upload PDF"
              hint="PDF file (max 50MB)"
              disabled={false}
            />

            {/* 2. Cover Image Upload */}
            <FileUploader
              control={form.control}
              name="coverImage"
              label="Cover Image (Optional)"
              acceptTypes={ACCEPTED_IMAGE_TYPES}
              icon={ImageIcon}
              placeholder="Click to upload cover image"
              hint="Leave empty to auto-generate from PDF"
              disabled={false}
            />

            {/* 3. Title Input */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="form-label">Title</FormLabel>
                  <FormControl>
                    <Input
                      className="form-input"
                      placeholder="ex: Rich Dad Poor Dad"
                      {...field}
                      disabled={false}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 4. Author Input */}
            <FormField
              control={form.control}
              name="author"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="form-label">Author Name</FormLabel>
                  <FormControl>
                    <Input
                      className="form-input"
                      placeholder="ex: Robert Kiyosaki"
                      {...field}
                      disabled={false}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 5. Voice Selector */}
            <FormField
              control={form.control}
              name="persona"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="form-label">
                    Choose Assistant Voice
                  </FormLabel>
                  <FormControl>
                    <VoiceSelector
                      value={field.value}
                      onChange={field.onChange}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 6. Submit Button */}
            <Button type="submit" className="form-btn" disabled={isSubmitting}>
              Begin Synthesis
            </Button>
          </form>
        </Form>
      </div>
    </>
  );
};

export default UploadForm;
