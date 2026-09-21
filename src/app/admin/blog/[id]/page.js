"use client";

import BlogForm from "@/components/admin/BlogForm";
import { useParams } from "next/navigation";

export default function EditBlogSingularRoutePage({ params: propParams }) {
   const routeParams = useParams();
   const id = routeParams?.id || propParams?.id;
   return <BlogForm blogId={id} />;
}
