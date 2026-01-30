"use client";

import Image from "next/image";
import Link from "next/link";
import { CpopQRButton } from "./cpop-qr-button";
import { WalletMultiButton } from "./solana/wallet-multi-button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";

interface Cpop {
  id: string;
  eventName: string;
  imageUrl: string | null;
  tokenAddress: string | null;
}

interface ManageCpopProps {
  cpops: Cpop[];
}

const ManageCpop = async ({ cpops }: ManageCpopProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Manage cPops</CardTitle>
        <div className="flex justify-end mb-6 gap-4 items-center">
          <Link href={`/`} className="mr-4 text-gray-400 hover:text-gray-200">
            Create Event
          </Link>

          <WalletMultiButton />
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Event Name</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cpops?.map((cpop) => (
              <TableRow key={cpop.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {cpop.imageUrl && (
                      <div className="relative h-10 w-10">
                        <Image
                          src={cpop.imageUrl}
                          alt={cpop.eventName}
                          fill
                          className="object-cover rounded-md"
                        />
                      </div>
                    )}
                    {cpop.eventName}
                  </div>
                </TableCell>
                <TableCell className="font-mono text-sm">
                  <div className="flex items-center gap-2">
                    <CpopQRButton cpopId={cpop.id} eventName={cpop.eventName} />

                    {cpop.tokenAddress ? (
                      <a
                        target="_blank"
                        rel="noopener noreferrer"
                        href={`https://explorer.solana.com/account/${cpop.tokenAddress}?cluster=mainnet-beta`}
                      >
                        View Token
                      </a>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default ManageCpop;
