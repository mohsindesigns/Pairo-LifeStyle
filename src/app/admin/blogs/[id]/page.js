"use client";

import BlogForm from "@/components/admin/BlogForm";
import { useParams } from "next/navigation";
import RequirePermission from "@/components/admin/RequirePermission";

export default function EditBlogPage({ params: propParams }) {
   const routeParams = useParams();
   const id = routeParams?.id || propParams?.id;
   return (
     <RequirePermission permission="blogs.edit">
       <BlogForm blogId={id} />
     </RequirePermission>
   );
}
