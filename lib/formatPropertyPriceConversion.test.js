import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatPropertyPriceConversion } from "./formatPropertyPriceConversion.js";

describe("formatPropertyPriceConversion — PKR", () => {
  it("uses thousand below 100,000", () => {
    assert.equal(formatPropertyPriceConversion(50000, "PKR"), "50 thousand");
    assert.equal(formatPropertyPriceConversion(75000, "PKR"), "75 thousand");
    assert.equal(formatPropertyPriceConversion(99999, "PKR"), "100 thousand");
  });

  it("uses lakh from 100,000 up to below 1,000,000", () => {
    assert.equal(formatPropertyPriceConversion(100000, "PKR"), "1 lakh");
    assert.equal(formatPropertyPriceConversion(500000, "PKR"), "5 lakh");
    assert.equal(formatPropertyPriceConversion(750000, "PKR"), "7.5 lakh");
    assert.equal(formatPropertyPriceConversion(900000, "PKR"), "9 lakh");
    assert.equal(formatPropertyPriceConversion(999999, "PKR"), "10 lakh");
  });

  it("uses million from 1,000,000 up to below 10,000,000", () => {
    assert.equal(formatPropertyPriceConversion(1000000, "PKR"), "1 million");
    assert.equal(formatPropertyPriceConversion(2500000, "PKR"), "2.5 million");
    assert.equal(formatPropertyPriceConversion(7000000, "PKR"), "7 million");
    assert.equal(formatPropertyPriceConversion(9000000, "PKR"), "9 million");
    assert.equal(formatPropertyPriceConversion(9999999, "PKR"), "10 million");
  });

  it("uses crore at 10,000,000 and above", () => {
    assert.equal(formatPropertyPriceConversion(10000000, "PKR"), "1 crore");
    assert.equal(formatPropertyPriceConversion(25000000, "PKR"), "2.5 crore");
    assert.equal(formatPropertyPriceConversion(70000000, "PKR"), "7 crore");
    assert.equal(formatPropertyPriceConversion(100000000, "PKR"), "10 crore");
  });
});

describe("formatPropertyPriceConversion — USD", () => {
  it("uses thousand below 1,000,000", () => {
    assert.equal(
      formatPropertyPriceConversion(100000, "USD"),
      "$100 thousand",
    );
    assert.equal(
      formatPropertyPriceConversion(500000, "USD"),
      "$500 thousand",
    );
    assert.equal(
      formatPropertyPriceConversion(750000, "USD"),
      "$750 thousand",
    );
  });

  it("uses million from 1,000,000 up to below 1,000,000,000", () => {
    assert.equal(formatPropertyPriceConversion(1000000, "USD"), "$1 million");
    assert.equal(formatPropertyPriceConversion(2500000, "USD"), "$2.5 million");
    assert.equal(formatPropertyPriceConversion(7000000, "USD"), "$7 million");
    assert.equal(formatPropertyPriceConversion(25000000, "USD"), "$25 million");
  });

  it("uses billion from 1,000,000,000", () => {
    assert.equal(
      formatPropertyPriceConversion(1000000000, "USD"),
      "$1 billion",
    );
    assert.equal(
      formatPropertyPriceConversion(2500000000, "USD"),
      "$2.5 billion",
    );
  });
});

describe("formatPropertyPriceConversion — edge cases", () => {
  it("returns null for missing or invalid prices", () => {
    assert.equal(formatPropertyPriceConversion(null, "PKR"), null);
    assert.equal(formatPropertyPriceConversion(undefined, "PKR"), null);
    assert.equal(formatPropertyPriceConversion("", "PKR"), null);
    assert.equal(formatPropertyPriceConversion("abc", "PKR"), null);
    assert.equal(formatPropertyPriceConversion(Number.NaN, "USD"), null);
  });

  it("returns null for unknown currency", () => {
    assert.equal(formatPropertyPriceConversion(7000000, "EUR"), null);
    assert.equal(formatPropertyPriceConversion(7000000, ""), null);
    assert.equal(formatPropertyPriceConversion(7000000, null), null);
  });

  it("handles zero and decimal prices", () => {
    assert.equal(formatPropertyPriceConversion(0, "PKR"), "0 thousand");
    assert.equal(formatPropertyPriceConversion(0, "USD"), "$0 thousand");
    assert.equal(formatPropertyPriceConversion(2250000, "PKR"), "2.25 million");
    assert.equal(formatPropertyPriceConversion(1500000.5, "PKR"), "1.5 million");
  });

  it("handles very large values", () => {
    assert.equal(
      formatPropertyPriceConversion(5_000_000_000, "PKR"),
      "500 crore",
    );
    assert.equal(
      formatPropertyPriceConversion(5_000_000_000, "USD"),
      "$5 billion",
    );
  });

  it("is case-insensitive for currency codes", () => {
    assert.equal(formatPropertyPriceConversion(70000000, "pkr"), "7 crore");
    assert.equal(formatPropertyPriceConversion(7000000, "usd"), "$7 million");
  });
});
