import { Flex, SimpleGrid } from "@chakra-ui/react";
import Link from "next/link";
import { useRouter } from "next/router";

export const features = [
  {
    name: "Home",
    path: "/",
    icons: "home-icons",
  },
  {
    name: "Liquidity",
    path: "/liquidity",
    icons: "liquidity",
  },
  {
    name: "Swap",
    path: "/",
    icons: "swap-icons",
  },
  {
    name: "Pools",
    path: "/pools",
    icons: "pool-icons",
  },
  {
    name: "Farms",
    path: "/farms",
    icons: "farm-icons",
  },
  {
    name: "NFTs",
    path: "/nfts",
    icons: "nft-icons",
  },
  {
    name: "Docs",
    path: "/",
    icons: "docs",
    isExternal: true,
  },
];

export const Features = () => {
  const router = useRouter();
  return (
    <SimpleGrid
      columns={[7]}
      color="text.primary"
      fontWeight={500}
      display={{
        xs: "none",
        xl: "grid",
      }}
      className="ml-[-100px]"
    >
      {features.map((e) => (
        <Link href={e.path} key={e.name} target={e.isExternal ? "_blank" : ""} >
          <Flex
            color={router?.asPath === e.path ? "#1ED760" : ""}
            alignItems={"center"}
            justifyContent={"center"}
            
          >
            {e.name}
          </Flex>
        </Link>
      ))}
    </SimpleGrid>
  );
};
